---
theme: dashboard
title: GTest Performance Dashboard
toc: false
---

# GTest timing by platform

```js
const runData = FileAttachment("data/gtest-utility.json").json();
```

```js
const testRows = runData.tests;
const summary = runData.summary;

const slowestByPlatform = d3.rollups(
  testRows,
  (rows) => d3.greatest(rows, (d) => d.timeMs),
  (d) => d.platform
).map(([platform, row]) => ({platform, ...row}));

const topSlowTests = d3
  .rollups(
    testRows,
    (rows) => d3.max(rows, (d) => d.timeMs),
    (d) => d.fullName
  )
  .map(([fullName, maxMs]) => ({fullName, maxMs}))
  .sort((a, b) => d3.descending(a.maxMs, b.maxMs))
  .slice(0, 12);

const topSlowNames = new Set(topSlowTests.map((d) => d.fullName));
const topSlowRows = testRows.filter((d) => topSlowNames.has(d.fullName));

const matrixRows = d3
  .rollups(
    testRows,
    (rows) => d3.mean(rows, (d) => d.timeMs),
    (d) => d.fullName,
    (d) => d.platform
  )
  .flatMap(([fullName, byPlatform]) => byPlatform.map(([platform, timeMs]) => ({fullName, platform, timeMs})))
  .sort((a, b) => d3.descending(a.timeMs, b.timeMs));

const commitTimelineRows = (runData.actions?.commits ?? [])
  .flatMap((entry) => {
    const commitDate = entry.commit?.authorDate ? new Date(entry.commit.authorDate) : null;
    if (!commitDate || Number.isNaN(+commitDate)) return [];
    return (entry.performance?.platforms ?? []).map((platformPerf) => ({
      commitSha: entry.commit.sha,
      commitShortSha: entry.commit.sha?.slice(0, 7),
      commitDate,
      platform: platformPerf.platform,
      totalMs: platformPerf.totalMs,
      tests: platformPerf.tests
    }));
  })
  .sort((a, b) => d3.ascending(a.commitDate, b.commitDate));

const commitAverageTimelineRows = d3
  .rollups(
    commitTimelineRows,
    (rows) => ({
      commitSha: rows[0].commitSha,
      commitShortSha: rows[0].commitShortSha,
      commitDate: rows[0].commitDate,
      avgTotalMs: d3.mean(rows, (d) => d.totalMs),
      maxTotalMs: d3.max(rows, (d) => d.totalMs),
      platformCount: rows.length
    }),
    (d) => d.commitSha
  )
  .map(([, row]) => row)
  .sort((a, b) => d3.ascending(a.commitDate, b.commitDate));
```

<div class="grid grid-cols-4">
  ${summary.map(
    (d) => html`<div class="card">
      <h2>${d.platform}</h2>
      <div class="big">${d.totalMs.toFixed(3)} ms</div>
      <div class="muted">${d.tests} tests</div>
      <div class="muted">${d.timestamp}</div>
    </div>`
  )}
</div>

<div class="grid grid-cols-3">
  ${slowestByPlatform.map(
    (d) => html`<div class="card">
      <h2>Slowest on ${d.platform}</h2>
      <div><strong>${d.fullName}</strong></div>
      <div class="big">${d.timeMs.toFixed(3)} ms</div>
    </div>`
  )}
</div>

<div class="grid grid-cols-1">
  <div class="card">
    ${commitTimelineRows.length > 0 ? resize((width) =>
      Plot.plot({
        title: "Performance timeline between commits",
        subtitle: "Total gtest runtime by platform",
        width,
        height: 360,
        x: {type: "time", label: "Commit date", grid: true},
        y: {label: "Total time (ms)", grid: true},
        color: {legend: true},
        marks: [
          Plot.lineY(commitTimelineRows, {x: "commitDate", y: "totalMs", stroke: "platform", tip: true}),
          Plot.dot(commitTimelineRows, {
            x: "commitDate",
            y: "totalMs",
            fill: "platform",
            tip: true,
            title: (d) => `${d.platform} • ${d.commitShortSha} • ${d.totalMs.toFixed(3)} ms`
          })
        ]
      })
    ) : html`<div class="muted">No commit timeline data available.</div>`}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    ${commitAverageTimelineRows.length > 0 ? resize((width) =>
      Plot.plot({
        title: "Average runtime timeline",
        subtitle: "Cross-platform mean gtest runtime per commit",
        width,
        height: 320,
        x: {type: "time", label: "Commit date", grid: true},
        y: {label: "Average time (ms)", grid: true},
        marks: [
          Plot.lineY(commitAverageTimelineRows, {x: "commitDate", y: "avgTotalMs", stroke: "var(--theme-foreground-focus)", tip: true}),
          Plot.dot(commitAverageTimelineRows, {
            x: "commitDate",
            y: "avgTotalMs",
            fill: "var(--theme-foreground-focus)",
            tip: true,
            title: (d) => `${d.commitShortSha} • avg ${d.avgTotalMs.toFixed(3)} ms • max ${d.maxTotalMs.toFixed(3)} ms`
          })
        ]
      })
    ) : html`<div class="muted">No average timeline data available.</div>`}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    ${resize((width) =>
      Plot.plot({
        title: "Top slow tests by platform",
        subtitle: "Max duration per test across Linux, Windows, macOS",
        width,
        height: 520,
        marginLeft: 260,
        x: {grid: true, label: "Time (ms)"},
        y: {label: null},
        color: {legend: true},
        marks: [
          Plot.barX(topSlowRows, {
            x: "timeMs",
            y: "fullName",
            fill: "platform",
            tip: true,
            sort: {y: "-x"},
            inset: 0.15
          }),
          Plot.ruleX([0])
        ]
      })
    )}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    ${resize((width) =>
      Plot.plot({
        title: "Per-test timing matrix",
        subtitle: "Darker cells indicate slower tests",
        width,
        height: 700,
        marginLeft: 260,
        x: {label: null},
        y: {label: null},
        color: {scheme: "blues", legend: true, label: "Time (ms)"},
        marks: [
          Plot.cell(matrixRows, {
            x: "platform",
            y: "fullName",
            fill: "timeMs",
            tip: true,
            sort: {y: "-fill"}
          })
        ]
      })
    )}
  </div>
</div>

<div class="card">
  Data source: commit
  <a href="https://github.com/etib-corp/utility/commit/${runData.source.commitSha}">${runData.source.commitSha.slice(0, 12)}</a>
  → ${runData.actions?.selectedBuildRun ? html`run <a href="${runData.actions.selectedBuildRun.htmlUrl}">#${runData.actions.selectedBuildRun.id}</a>` : "local snapshot"}
  (${runData.source.mode}) fetched at ${runData.source.fetchedAt}.
</div>

<style>
.big {
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.15;
}

.muted {
  color: var(--theme-foreground-muted);
}

</style>
