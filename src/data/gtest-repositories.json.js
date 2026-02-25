import { Octokit } from "octokit";
import JSZip from "jszip";

const DEFAULT_REPOSITORIES = ["etib-corp/utility"];
const DEFAULT_BASE_COMMITS = {
  "etib-corp/utility": "5e5e76cf451bccddaf1b38245b6085695b69f7fa"
};

function parseRepoList(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [owner, repo] = item.split("/");
      if (!owner || !repo) {
        throw new Error(`Invalid repository identifier: ${item}. Expected owner/repo format.`);
      }
      return { owner, repo, key: `${owner}/${repo}` };
    });
}

function parseBaseCommitMap(value) {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Ignore and fall back to defaults.
  }
  return DEFAULT_BASE_COMMITS;
}

const TARGET_REPOSITORIES = parseRepoList(process.env.GITHUB_TARGET_REPOS ?? DEFAULT_REPOSITORIES.join(","));
const BASE_COMMIT_BY_REPOSITORY = parseBaseCommitMap(process.env.GITHUB_BASE_COMMIT_BY_REPO ?? JSON.stringify(DEFAULT_BASE_COMMITS));
const MAX_COMMIT_AGE_DAYS = Number.parseInt(process.env.GITHUB_MAX_COMMIT_AGE_DAYS ?? "90", 10);

const token = process.env.GITHUB_TOKEN;
const octokit = new Octokit(token ? { auth: token } : {});

function parseTimeToMilliseconds(value) {
  if (value == null) return 0;
  const text = String(value).trim();
  if (!text) return 0;
  const numeric = Number.parseFloat(text.replace(/s$/, ""));
  if (Number.isNaN(numeric)) return 0;
  return numeric * 1000;
}

function detectPlatform(name) {
  const lowered = name.toLowerCase();
  if (lowered.includes("ubuntu") || lowered.includes("linux")) return "Linux";
  if (lowered.includes("windows")) return "Windows";
  if (lowered.includes("macos") || lowered.includes("mac")) return "macOS";
  return null;
}

function isPerformanceTest(suiteName, testName) {
  const suite = String(suiteName ?? "").toLowerCase();
  const test = String(testName ?? "").toLowerCase();
  return (
    suite.startsWith("performance") ||
    suite.startsWith("testperformance") ||
    test.startsWith("performance") ||
    test.startsWith("testperformance")
  );
}

function extractRows(report, platform) {
  return (report.testsuites ?? []).flatMap((suite) =>
    (suite.testsuite ?? [])
      .filter((test) => isPerformanceTest(suite.name, test.name))
      .map((test) => ({
        platform,
        suite: suite.name,
        test: test.name,
        fullName: `${suite.name}.${test.name}`,
        timeMs: parseTimeToMilliseconds(test.time),
        status: test.result ?? "UNKNOWN"
      }))
  );
}

function summarizePerformanceByCommit(reportsByPlatform) {
  const platforms = ["Linux", "Windows", "macOS"]
    .filter((platform) => reportsByPlatform.has(platform))
    .map((platform) => {
      const report = reportsByPlatform.get(platform);
      const rows = extractRows(report, platform);
      return {
        platform,
        totalMs: rows.reduce((acc, row) => acc + row.timeMs, 0),
        tests: rows.length,
        failures: rows.filter((row) => row.status !== "COMPLETED").length,
        errors: 0,
        timestamp: report.timestamp ?? null
      };
    });

  const totalMsValues = platforms.map((d) => d.totalMs);
  return {
    platforms,
    meanTotalMs: totalMsValues.length ? totalMsValues.reduce((acc, value) => acc + value, 0) / totalMsValues.length : 0,
    maxTotalMs: totalMsValues.length ? Math.max(...totalMsValues) : 0
  };
}

async function readArtifactZipJson(owner, repo, artifactId) {
  const response = await octokit.request("GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}", {
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: "zip"
  });

  const archiveBuffer = Buffer.from(response.data);
  const zip = await JSZip.loadAsync(archiveBuffer);

  const jsonFiles = Object.values(zip.files)
    .filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".json"));

  const reports = [];
  for (const jsonFile of jsonFiles) {
    const content = await jsonFile.async("string");
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed?.tests === "number" && Array.isArray(parsed?.testsuites)) {
        reports.push({ fileName: jsonFile.name, parsed });
      }
    } catch {
      // Skip non-gtest JSON files.
    }
  }

  return reports;
}

function pickBuildRun(runs) {
  if (!runs.length) return null;
  const buildLike = runs.filter((run) => /build/i.test(run.name ?? "") || /build/i.test(run.display_title ?? ""));
  const candidates = buildLike.length ? buildLike : runs;
  const successful = candidates.find((run) => run.conclusion === "success");
  return successful ?? candidates[0];
}

function summarizeRun(run) {
  return {
    id: run.id,
    name: run.name,
    workflowName: run.display_title,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    htmlUrl: run.html_url,
    runNumber: run.run_number,
    headBranch: run.head_branch,
    headSha: run.head_sha
  };
}

function hasAllPlatforms(reportsByPlatform) {
  return ["Linux", "Windows", "macOS"].every((platform) => reportsByPlatform.has(platform));
}

async function fetchCommitsAfterBaseWithinWindow(owner, repo, baseCommitSha) {
  const commits = await octokit.paginate("GET /repos/{owner}/{repo}/commits", {
    owner,
    repo,
    per_page: 100
  });

  let candidateCommits = commits;
  if (baseCommitSha) {
    const baseIndex = commits.findIndex((commit) => commit.sha === baseCommitSha);
    if (baseIndex < 0) {
      throw new Error(`Base commit not found for ${owner}/${repo}: ${baseCommitSha}`);
    }
    candidateCommits = commits.slice(0, baseIndex);
  }

  const cutoff = Date.now() - MAX_COMMIT_AGE_DAYS * 24 * 60 * 60 * 1000;

  return candidateCommits
    .filter((commit) => {
      const timestamp = Date.parse(commit.commit?.author?.date ?? "");
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
}

async function fetchActionsForCommit(owner, repo, sha) {
  const runsResponse = await octokit.request("GET /repos/{owner}/{repo}/actions/runs", {
    owner,
    repo,
    head_sha: sha,
    per_page: 100
  });

  const runs = runsResponse.data.workflow_runs ?? [];
  if (!runs.length) return { runs: [], selectedBuildRun: null, artifacts: [], reportsByPlatform: new Map() };

  const buildRun = pickBuildRun(runs);
  if (!buildRun) return { runs: runs.map(summarizeRun), selectedBuildRun: null, artifacts: [], reportsByPlatform: new Map() };

  const artifacts = await octokit.paginate("GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts", {
    owner,
    repo,
    run_id: buildRun.id,
    per_page: 100
  });

  const reportsByPlatform = new Map();
  const artifactSummaries = [];

  for (const artifact of artifacts) {
    artifactSummaries.push({
      id: artifact.id,
      name: artifact.name,
      sizeInBytes: artifact.size_in_bytes,
      expired: artifact.expired,
      createdAt: artifact.created_at,
      updatedAt: artifact.updated_at,
      archiveDownloadUrl: artifact.archive_download_url
    });

    const artifactPlatform = detectPlatform(artifact.name);
    const reportFiles = await readArtifactZipJson(owner, repo, artifact.id);
    for (const { fileName, parsed } of reportFiles) {
      const platform = artifactPlatform ?? detectPlatform(fileName);
      if (!platform) continue;
      reportsByPlatform.set(platform, parsed);
    }
  }

  return {
    runs: runs.map(summarizeRun),
    selectedBuildRun: summarizeRun(buildRun),
    artifacts: artifactSummaries,
    reportsByPlatform
  };
}

let reportsByPlatform;
let actionsMetadata = null;
let commitMetadata = null;
let selectedRepository = null;

const repositoryScans = [];
const successfulSelections = [];

for (const repository of TARGET_REPOSITORIES) {
  const baseCommitSha = BASE_COMMIT_BY_REPOSITORY[repository.key];
  const candidateCommits = await fetchCommitsAfterBaseWithinWindow(repository.owner, repository.repo, baseCommitSha);

  const actionsByCommit = [];
  let selectedData = null;

  for (const commit of candidateCommits) {
    const actionData = await fetchActionsForCommit(repository.owner, repository.repo, commit.sha);
    const performance = summarizePerformanceByCommit(actionData.reportsByPlatform);
    actionsByCommit.push({
      commit: {
        sha: commit.sha,
        message: commit.commit?.message,
        authorName: commit.commit?.author?.name,
        authorDate: commit.commit?.author?.date,
        htmlUrl: commit.html_url
      },
      runs: actionData.runs,
      selectedBuildRun: actionData.selectedBuildRun,
      artifacts: actionData.artifacts,
      performance
    });

    if (!selectedData && hasAllPlatforms(actionData.reportsByPlatform)) {
      selectedData = { commit, actionData };
    }
  }

  repositoryScans.push({
    repository: repository.key,
    baseCommitSha: baseCommitSha ?? null,
    scannedCommitCount: candidateCommits.length,
    commits: actionsByCommit
  });

  if (selectedData) {
    successfulSelections.push({ repository, selectedData, scannedCommitCount: candidateCommits.length, actionsByCommit });
  }
}

if (!successfulSelections.length) {
  throw new Error(`No usable build artifacts found across repositories (${TARGET_REPOSITORIES.map((d) => d.key).join(", ")}) within ${MAX_COMMIT_AGE_DAYS} days`);
}

successfulSelections.sort((a, b) => {
  const da = Date.parse(a.selectedData.commit.commit?.author?.date ?? "");
  const db = Date.parse(b.selectedData.commit.commit?.author?.date ?? "");
  return Number.isFinite(db) && Number.isFinite(da) ? db - da : 0;
});

const picked = successfulSelections[0];
selectedRepository = picked.repository;
const selectedData = picked.selectedData;

reportsByPlatform = selectedData.actionData.reportsByPlatform;
commitMetadata = {
  repository: selectedRepository.key,
  sha: selectedData.commit.sha,
  message: selectedData.commit.commit?.message,
  authorName: selectedData.commit.commit?.author?.name,
  authorDate: selectedData.commit.commit?.author?.date,
  htmlUrl: selectedData.commit.html_url
};
actionsMetadata = {
  repository: selectedRepository.key,
  selectedBuildRun: selectedData.actionData.selectedBuildRun,
  artifacts: selectedData.actionData.artifacts,
  scannedCommitCount: picked.scannedCommitCount,
  commits: picked.actionsByCommit,
  scannedRepositories: repositoryScans
};

const expectedPlatforms = ["Linux", "Windows", "macOS"];
const missing = expectedPlatforms.filter((platform) => !reportsByPlatform.has(platform));
if (missing.length) {
  throw new Error(`Missing gtest reports for: ${missing.join(", ")}`);
}

const raw = Object.fromEntries(expectedPlatforms.map((platform) => [platform, reportsByPlatform.get(platform)]));
const tests = expectedPlatforms.flatMap((platform) => extractRows(reportsByPlatform.get(platform), platform));
const summary = expectedPlatforms.map((platform) => {
  const report = reportsByPlatform.get(platform);
  const rows = tests.filter((row) => row.platform === platform);
  return {
    platform,
    tests: rows.length,
    failures: rows.filter((row) => row.status !== "COMPLETED").length,
    errors: 0,
    totalMs: rows.reduce((acc, row) => acc + row.timeMs, 0),
    timestamp: report.timestamp
  };
});

process.stdout.write(
  `${JSON.stringify({
    source: {
      owner: selectedRepository.owner,
      repo: selectedRepository.repo,
      commitSha: selectedData.commit.sha,
      baseCommitSha: BASE_COMMIT_BY_REPOSITORY[selectedRepository.key] ?? null,
      maxCommitAgeDays: MAX_COMMIT_AGE_DAYS,
      mode: "github-artifacts",
      repositories: TARGET_REPOSITORIES.map((d) => d.key),
      fetchedAt: new Date().toISOString()
    },
    commit: commitMetadata,
    actions: actionsMetadata,
    summary,
    tests,
    raw
  }, null, 2)}\n`
);