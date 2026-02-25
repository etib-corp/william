import {Octokit} from "octokit";
import JSZip from "jszip";
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const OWNER = "etib-corp";
const REPO = "utility";
const COMMIT_SHA = "5e5e76cf451bccddaf1b38245b6085695b69f7fa";
const FALLBACK_RUN_ID = 22392812167;

const token = process.env.GITHUB_TOKEN;
const octokit = new Octokit(token ? {auth: token} : {});
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function extractRows(report, platform) {
  return (report.testsuites ?? []).flatMap((suite) =>
    (suite.testsuite ?? []).map((test) => ({
      platform,
      suite: suite.name,
      test: test.name,
      fullName: `${suite.name}.${test.name}`,
      timeMs: parseTimeToMilliseconds(test.time),
      status: test.result ?? "UNKNOWN"
    }))
  );
}

async function readArtifactZipJson(artifactId) {
  const response = await octokit.request("GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/{archive_format}", {
    owner: OWNER,
    repo: REPO,
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
        reports.push({fileName: jsonFile.name, parsed});
      }
    } catch {
      // Skip non-gtest JSON files.
    }
  }

  return reports;
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

async function fetchCommitAndActionsData() {
  const commits = await octokit.paginate("GET /repos/{owner}/{repo}/commits", {
    owner: OWNER,
    repo: REPO,
    per_page: 100
  });

  const matchedCommit = commits.find((commit) => commit.sha === COMMIT_SHA);
  if (!matchedCommit) {
    throw new Error(`Commit not found: ${COMMIT_SHA}`);
  }

  const runsResponse = await octokit.request("GET /repos/{owner}/{repo}/actions/runs", {
    owner: OWNER,
    repo: REPO,
    head_sha: COMMIT_SHA,
    per_page: 100
  });

  const runs = runsResponse.data.workflow_runs ?? [];
  if (!runs.length) {
    throw new Error(`No GitHub Actions runs found for commit ${COMMIT_SHA}`);
  }

  const buildRun =
    runs.find((run) => /build/i.test(run.name ?? "") || /build/i.test(run.display_title ?? "")) ?? runs[0];

  const artifacts = await octokit.paginate("GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts", {
    owner: OWNER,
    repo: REPO,
    run_id: buildRun.id,
    per_page: 100
  });

  if (!artifacts.length) {
    throw new Error(`No artifacts found for build run ${buildRun.id}`);
  }

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
    const reportFiles = await readArtifactZipJson(artifact.id);
    for (const {fileName, parsed} of reportFiles) {
      const platform = artifactPlatform ?? detectPlatform(fileName);
      if (!platform) continue;
      reportsByPlatform.set(platform, parsed);
    }
  }

  return {
    reportsByPlatform,
    commit: {
      sha: matchedCommit.sha,
      message: matchedCommit.commit?.message,
      authorName: matchedCommit.commit?.author?.name,
      authorDate: matchedCommit.commit?.author?.date,
      htmlUrl: matchedCommit.html_url
    },
    actions: {
      runs: runs.map(summarizeRun),
      selectedBuildRun: summarizeRun(buildRun),
      artifacts: artifactSummaries
    }
  };
}

async function readLocalSnapshot(relativePath) {
  const absolutePath = path.join(__dirname, relativePath);
  const content = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(content);
}

async function fetchReportsFromLocalFiles() {
  return new Map([
    ["Linux", await readLocalSnapshot("test-results-ubuntu-latest-5e5e76cf451bccddaf1b38245b6085695b69f7fa.json")],
    ["Windows", await readLocalSnapshot("test-results-windows-latest-5e5e76cf451bccddaf1b38245b6085695b69f7fa.json")],
    ["macOS", await readLocalSnapshot("test-results-macos-latest-5e5e76cf451bccddaf1b38245b6085695b69f7fa.json")]
  ]);
}

let reportsByPlatform;
let sourceMode = "github-artifacts";
let actionsMetadata = null;
let commitMetadata = null;

try {
  const githubData = await fetchCommitAndActionsData();
  reportsByPlatform = githubData.reportsByPlatform;
  commitMetadata = githubData.commit;
  actionsMetadata = githubData.actions;
} catch (error) {
  reportsByPlatform = await fetchReportsFromLocalFiles();
  sourceMode = "local-fallback";
  console.error(`GitHub artifact fetch failed, using local fallback: ${error.message}`);
}

const expectedPlatforms = ["Linux", "Windows", "macOS"];
const missing = expectedPlatforms.filter((platform) => !reportsByPlatform.has(platform));
if (missing.length) {
  throw new Error(`Missing gtest reports for: ${missing.join(", ")}`);
}

const raw = Object.fromEntries(expectedPlatforms.map((platform) => [platform, reportsByPlatform.get(platform)]));
const summary = expectedPlatforms.map((platform) => {
  const report = reportsByPlatform.get(platform);
  return {
    platform,
    tests: report.tests,
    failures: report.failures,
    errors: report.errors,
    totalMs: parseTimeToMilliseconds(report.time),
    timestamp: report.timestamp
  };
});

const tests = expectedPlatforms.flatMap((platform) => extractRows(reportsByPlatform.get(platform), platform));

process.stdout.write(
  `${JSON.stringify({
    source: {
      owner: OWNER,
      repo: REPO,
      commitSha: COMMIT_SHA,
      fallbackRunId: FALLBACK_RUN_ID,
      mode: sourceMode,
      fetchedAt: new Date().toISOString()
    },
    commit: commitMetadata,
    actions: actionsMetadata,
    summary,
    tests,
    raw
  }, null, 2)}\n`
);
