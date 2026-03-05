---
theme: dashboard
title: William - Track performance
toc: false
---

# GTest Performance Dashboard

Track runtime and stability across platforms and commits.

```js
const gtestData = await FileAttachment("data/gtest-performance.json").json();
const runs = (gtestData?.runs ?? [])
  .map((run) => ({
    ...run,
    date: run.timestamp ? new Date(run.timestamp) : null,
    passRate: run.tests > 0 ? (run.tests - run.failures - run.errors) / run.tests : 1,
    status: run.failures + run.errors > 0 ? "failing" : "passing"
  }))
  .filter((run) => run.date && Number.isFinite(run.date.valueOf()));

const latestRunAt = d3.max(runs, (d) => d.date);
const totalRuns = runs.length;
const totalFailures = d3.sum(runs, (d) => d.failures + d.errors);
const avgDurationMs = d3.mean(runs, (d) => d.durationMs) ?? 0;
const commitCount = new Set(runs.map((d) => d.commit)).size;
const platformCount = new Set(runs.map((d) => d.platform)).size;

const commitsByDate = d3.sort(
  d3.group(runs, (d) => d.commit),
  (a, b) => d3.ascending(d3.max(a[1], (d) => d.date), d3.max(b[1], (d) => d.date))
);
const latestCommit = commitsByDate.at(-1)?.[0] ?? null;
const previousCommit = commitsByDate.at(-2)?.[0] ?? null;

const commitComparison = runs
  .filter((d) => d.commit === latestCommit || d.commit === previousCommit)
  .map((d) => ({
    ...d,
    commitLabel: d.commit === latestCommit ? "latest" : "previous"
  }));

const suiteMetrics = runs.flatMap((run) =>
  run.suites.map((suite) => ({
    platform: run.platform,
    commit: run.commit,
    commitShort: run.commitShort,
    date: run.date,
    suite: suite.name,
    tests: suite.tests,
    issues: suite.failures + suite.errors,
    timeMs: suite.timeMs
  }))
);

const slowestSuites = d3
  .rollups(
    suiteMetrics,
    (values) => ({
      avgMs: d3.mean(values, (d) => d.timeMs) ?? 0,
      maxMs: d3.max(values, (d) => d.timeMs) ?? 0,
      runs: values.length,
      issues: d3.sum(values, (d) => d.issues)
    }),
    (d) => d.suite
  )
  .map(([suite, stats]) => ({suite, ...stats}))
  .sort((a, b) => d3.descending(a.avgMs, b.avgMs))
  .slice(0, 12);

const latestByPlatform = d3
  .rollups(
    runs,
    (values) => values.toSorted((a, b) => d3.ascending(a.date, b.date)).at(-1),
    (d) => d.platform
  )
  .map(([, run]) => run)
  .toSorted((a, b) => a.platform.localeCompare(b.platform));

const testCaseMetrics = runs.flatMap((run) =>
  run.suites.flatMap((suite) =>
    (suite.testCases ?? []).map((testCase) => ({
      platform: run.platform,
      commit: run.commit,
      commitShort: run.commitShort,
      date: run.date,
      suite: suite.name,
      test: testCase.fullName ?? `${testCase.className ?? suite.name}.${testCase.name ?? "unknown"}`,
      timeMs: testCase.timeMs ?? 0
    }))
  )
);

const slowerThanPrevious = [];
for (const [key, values] of d3.group(testCaseMetrics, (d) => `${d.platform}::${d.test}`)) {
  const ordered = values.toSorted((a, b) => d3.ascending(a.date, b.date));
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (current.timeMs > previous.timeMs) {
      slowerThanPrevious.push({
        key,
        platform: current.platform,
        test: current.test,
        currentCommit: current.commitShort,
        previousCommit: previous.commitShort,
        currentTimeMs: current.timeMs,
        previousTimeMs: previous.timeMs,
        deltaMs: current.timeMs - previous.timeMs,
        deltaPct: previous.timeMs > 0 ? (current.timeMs - previous.timeMs) / previous.timeMs : null,
        timestamp: current.date
      });
    }
  }
}

const topRegressions = slowerThanPrevious
  .toSorted((a, b) => d3.descending(a.deltaMs, b.deltaMs) || d3.descending(a.timestamp, b.timestamp))
  .slice(0, 20);
```

```js
const color = Plot.scale({
  color: {
    type: "categorical",
    domain: Array.from(new Set(runs.map((d) => d.platform))).sort()
  }
});
```

<div class="grid grid-cols-4">
  <div class="card">
    <h2>Total Runs</h2>
    <span class="big">${totalRuns.toLocaleString("en-US")}</span>
    <div class="muted">${commitCount} commits x ${platformCount} platforms</div>
  </div>
  <div class="card">
    <h2>Average Runtime</h2>
    <span class="big">${(avgDurationMs / 1000).toFixed(3)}s</span>
    <div class="muted">All platforms and commits</div>
  </div>
  <div class="card">
    <h2>Total Failures + Errors</h2>
    <span class="big">${totalFailures.toLocaleString("en-US")}</span>
    <div class="muted">Across all runs</div>
  </div>
  <div class="card">
    <h2>Latest Run</h2>
    <span class="big">${latestRunAt ? d3.utcFormat("%Y-%m-%d %H:%M")(latestRunAt) : "n/a"}</span>
    <div class="muted">UTC</div>
  </div>
</div>

```js
function runtimeTimeline(data, {width} = {}) {
  return Plot.plot({
    title: "Runtime Trend by Platform",
    width,
    height: 360,
    x: {label: "Run timestamp (UTC)"},
    y: {grid: true, label: "Duration (s)"},
    color: {...color, legend: true},
    marks: [
      Plot.ruleY([0]),
      Plot.lineY(data, {
        x: "date",
        y: (d) => d.durationMs / 1000,
        stroke: "platform",
        marker: true,
        tip: true
      }),
      Plot.dot(data, {
        x: "date",
        y: (d) => d.durationMs / 1000,
        fill: "platform",
        title: (d) => `${d.platform} ${d.commitShort} ${(d.durationMs / 1000).toFixed(3)}s`,
        tip: true
      }),
      Plot.ruleY([0])
    ]
  });
}
```

<div class="grid grid-cols-2" style="grid-auto-rows: 380px;">
  <div class="card">
    ${resize((width) => runtimeTimeline(runs, {width}))}
  </div>
  <div class="card">
    ${resize((width) =>
      Plot.plot({
        title: "Pass Rate by Platform",
        width,
        height: 360,
        x: {label: "Run timestamp (UTC)"},
        y: {grid: true, label: "Pass rate", tickFormat: "%"},
        color: {...color, legend: true},
        marks: [
          Plot.ruleY([1]),
          Plot.lineY(runs, {
            x: "date",
            y: "passRate",
            stroke: "platform",
            marker: true,
            tip: true
          }),
          Plot.dot(runs, {
            x: "date",
            y: "passRate",
            fill: "platform",
            title: (d) => `${d.platform} ${d.commitShort} ${(d.passRate * 100).toFixed(1)}%`,
            tip: true
          })
        ]
      })
    )}
  </div>
</div>

```js
function latestRuntimeComparison(data, {width}) {
  return Plot.plot({
    title: "Latest Runtime by Platform",
    width,
    height: 300,
    marginLeft: 120,
    x: {grid: true, label: "Duration (s)"},
    y: {label: null},
    color: {...color, legend: true},
    marks: [
      Plot.barX(data, {
        x: (d) => d.durationMs / 1000,
        y: "platform",
        fill: "platform",
        sort: {y: "x"},
        tip: true
      }),
      Plot.ruleX([0])
    ]
  });
}
```

<div class="grid grid-cols-2" style="grid-auto-rows: 360px;">
  <div class="card">
    ${resize((width) => latestRuntimeComparison(latestByPlatform, {width}))}
  </div>
  <div class="card">
    ${resize((width) =>
      Plot.plot({
        title: "Runtime Distribution by Platform",
        width,
        height: 300,
        x: {label: "Platform"},
        y: {grid: true, label: "Duration (s)"},
        color: {...color, legend: false},
        marks: [
          Plot.boxY(runs, {
            x: "platform",
            y: (d) => d.durationMs / 1000,
            fill: "platform",
            tip: true
          }),
          Plot.dot(runs, {
            x: "platform",
            y: (d) => d.durationMs / 1000,
            stroke: "platform",
            opacity: 0.4,
            r: 2,
            tip: true
          })
        ]
      })
    )}
  </div>
</div>

## Commit Comparison

${latestCommit && previousCommit
  ? Inputs.table(
      commitComparison
        .map((run) => ({
          baseline: run.commitLabel,
          platform: run.platform,
          commit: run.commitShort,
          tests: run.tests,
          failures: run.failures,
          errors: run.errors,
          runtimeSec: (run.durationMs / 1000).toFixed(3),
          passRate: `${(run.passRate * 100).toFixed(1)}%`
}))
        .toSorted((a, b) => a.platform.localeCompare(b.platform) || a.baseline.localeCompare(b.baseline)),
      {layout: "fixed", rows: 12}
    )
  : html`<div class="card">Need at least two commits to compare.</div>`}

## Slowest Test Suites

${Inputs.table(
  slowestSuites.map((suite) => ({
    suite: suite.suite,
    avgRuntimeSec: (suite.avgMs / 1000).toFixed(4),
    maxRuntimeSec: (suite.maxMs / 1000).toFixed(4),
    runs: suite.runs,
    issues: suite.issues
  })),
  {layout: "fixed", rows: 12}
)}

## Latest Platform Status

${Inputs.table(
  latestByPlatform.map((run) => ({
    platform: run.platform,
    commit: run.commitShort,
    timestampUTC: d3.utcFormat("%Y-%m-%d %H:%M:%S")(run.date),
    tests: run.tests,
    failures: run.failures,
    errors: run.errors,
    runtimeSec: (run.durationMs / 1000).toFixed(3),
    status: run.status
  })),
  {layout: "fixed", rows: 12}
)}

## Slower Than Previous Run

${topRegressions.length > 0
  ? Inputs.table(
      topRegressions.map((row) => ({
        platform: row.platform,
        test: row.test,
        previousCommit: row.previousCommit,
        currentCommit: row.currentCommit,
        previousSec: (row.previousTimeMs / 1000).toFixed(4),
        currentSec: (row.currentTimeMs / 1000).toFixed(4),
        deltaMs: row.deltaMs,
        deltaPct: row.deltaPct == null ? "n/a" : `${(row.deltaPct * 100).toFixed(1)}%`,
        timestampUTC: d3.utcFormat("%Y-%m-%d %H:%M:%S")(row.timestamp)
      })),
      {layout: "fixed", rows: 20}
    )
  : html`<div class="card">No runtime regressions detected compared to the previous run per test.</div>`}
