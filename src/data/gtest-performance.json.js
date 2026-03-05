import {readdir, readFile} from "node:fs/promises";

const DATA_DIR = new URL(".", import.meta.url);
const RESULT_FILE = /^test-results-([^-]+-[^-]+)-([0-9a-f]{40})\.json$/;

function parseDurationMs(value) {
  if (typeof value !== "string") return 0;
  const trimmed = value.trim();
  if (!trimmed.endsWith("s")) return 0;
  const numeric = Number.parseFloat(trimmed.slice(0, -1));
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 1000);
}

const entries = await readdir(DATA_DIR, {withFileTypes: true});
const rows = [];

for (const entry of entries) {
  if (!entry.isFile()) continue;

  const match = RESULT_FILE.exec(entry.name);
  if (!match) continue;

  const [, platform, commit] = match;
  const fileUrl = new URL(entry.name, DATA_DIR);
  const raw = await readFile(fileUrl, "utf8");
  const report = JSON.parse(raw);

  const suites = Array.isArray(report.testsuites) ? report.testsuites : [];
  const suiteRows = suites.map((suite) => {
    const suiteName = suite.name ?? "unknown";
    const testCases = Array.isArray(suite.testsuite) ? suite.testsuite : [];
    const tests = testCases.map((testCase) => {
      const className = testCase.classname ?? suiteName;
      const name = testCase.name ?? "unknown";
      return {
        className,
        name,
        fullName: `${className}.${name}`,
        status: testCase.status ?? null,
        result: testCase.result ?? null,
        timeMs: parseDurationMs(testCase.time)
      };
    });

    return {
      name: suiteName,
      tests: Number(suite.tests ?? 0),
      failures: Number(suite.failures ?? 0),
      errors: Number(suite.errors ?? 0),
      disabled: Number(suite.disabled ?? 0),
      timeMs: parseDurationMs(suite.time),
      testCases: tests
    };
  });

  rows.push({
    fileName: entry.name,
    platform,
    commit,
    commitShort: commit.slice(0, 7),
    timestamp: report.timestamp ?? null,
    tests: Number(report.tests ?? 0),
    failures: Number(report.failures ?? 0),
    errors: Number(report.errors ?? 0),
    disabled: Number(report.disabled ?? 0),
    durationSeconds: report.time ?? "0s",
    durationMs: parseDurationMs(report.time),
    suites: suiteRows
  });
}

rows.sort((a, b) => {
  const ta = Date.parse(a.timestamp ?? "") || 0;
  const tb = Date.parse(b.timestamp ?? "") || 0;
  if (ta !== tb) return ta - tb;
  if (a.commit !== b.commit) return a.commit.localeCompare(b.commit);
  return a.platform.localeCompare(b.platform);
});

const commits = Array.from(new Set(rows.map((row) => row.commit)));
const platforms = Array.from(new Set(rows.map((row) => row.platform)));

const output = {
  generatedAt: new Date().toISOString(),
  summary: {
    runCount: rows.length,
    commitCount: commits.length,
    platformCount: platforms.length,
    platforms,
    commits
  },
  runs: rows
};

process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
