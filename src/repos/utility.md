---
theme: dashboard
title: Utility - GTest Performance
toc: false
---

# Utility performance dashboard

```js
const runData = FileAttachment("../data/gtest-utility.json").json();
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

const commitRows = (runData.actions?.commits ?? [])
  .map((entry) => {
    const commitDate = entry.commit?.authorDate ? new Date(entry.commit.authorDate) : null;
    if (!commitDate || Number.isNaN(+commitDate)) return null;

    const platforms = entry.performance?.platforms ?? [];
    const avgTotalMs = platforms.length ? d3.mean(platforms, (d) => d.totalMs) : null;
    const maxTotalMs = platforms.length ? d3.max(platforms, (d) => d.totalMs) : null;
    const tests = platforms.length ? d3.max(platforms, (d) => d.tests) : null;

    return {
      commitSha: entry.commit.sha,
      commitShortSha: entry.commit.sha?.slice(0, 7),
      commitDate,
      authorName: entry.commit.authorName,
      message: String(entry.commit.message ?? "").split("\n")[0],
      htmlUrl: entry.commit.htmlUrl,
      avgTotalMs,
      maxTotalMs,
      tests,
      selectedBuildRun: entry.selectedBuildRun,
      platformCount: platforms.length
    };
  })
  .filter(Boolean)
  .sort((a, b) => d3.descending(a.commitDate, b.commitDate))
  .map((row, index, rows) => {
    const previous = rows[index + 1];
    const deltaMs = previous?.avgTotalMs != null && row.avgTotalMs != null ? row.avgTotalMs - previous.avgTotalMs : null;
    const deltaPct = previous?.avgTotalMs ? (deltaMs / previous.avgTotalMs) * 100 : null;
    return {...row, deltaMs, deltaPct};
  });

const commitOverview = {
  commitCount: commitRows.length,
  latestCommitDate: commitRows[0]?.commitDate ?? null,
  bestAvgMs: commitRows.length ? d3.min(commitRows, (d) => d.avgTotalMs) : null,
  worstAvgMs: commitRows.length ? d3.max(commitRows, (d) => d.avgTotalMs) : null
};

const commitSearch = view(Inputs.text({
  label: "Filter commits",
  placeholder: "Search by SHA, author, or message"
}));

const commitDateRange = view(Inputs.select(
  [
    {label: "All", value: "all"},
    {label: "Last 7 days", value: "7d"},
    {label: "Last 30 days", value: "30d"},
    {label: "Last 90 days", value: "90d"}
  ],
  {
    label: "Date range",
    value: "90d",
    format: (d) => d.label
  }
));

const commitDateRangeDays = commitDateRange === "7d" ? 7 : commitDateRange === "30d" ? 30 : commitDateRange === "90d" ? 90 : null;
const commitDateCutoff = commitDateRangeDays ? Date.now() - commitDateRangeDays * 24 * 60 * 60 * 1000 : null;

const commitRowsFiltered = commitRows.filter((row) => {
  const query = String(commitSearch ?? "").trim().toLowerCase();
  const matchesText = !query || [row.commitSha, row.commitShortSha, row.authorName, row.message]
    .map((value) => String(value ?? "").toLowerCase())
    .some((value) => value.includes(query));
  const matchesDate = !commitDateCutoff || +row.commitDate >= commitDateCutoff;
  return matchesText && matchesDate;
});
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

<div class="grid grid-cols-4">
  <div class="card">
    <h2>Commit window</h2>
    <div class="big">${commitOverview.commitCount}</div>
    <div class="muted">commits with runtime data</div>
  </div>
  <div class="card">
    <h2>Latest commit</h2>
    <div><strong>${commitRows[0]?.commitShortSha ?? "n/a"}</strong></div>
    <div class="muted">${commitOverview.latestCommitDate ? commitOverview.latestCommitDate.toISOString().slice(0, 10) : "n/a"}</div>
  </div>
  <div class="card">
    <h2>Best avg runtime</h2>
    <div class="big">${commitOverview.bestAvgMs != null ? `${commitOverview.bestAvgMs.toFixed(3)} ms` : "n/a"}</div>
  </div>
  <div class="card">
    <h2>Worst avg runtime</h2>
    <div class="big">${commitOverview.worstAvgMs != null ? `${commitOverview.worstAvgMs.toFixed(3)} ms` : "n/a"}</div>
  </div>
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
    <h2>Commit performance list</h2>
    <div class="muted">Showing ${commitRowsFiltered.length} of ${commitRows.length} commits</div>
    ${commitRowsFiltered.length > 0
      ? html`<table class="commit-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Commit</th>
              <th>Author</th>
              <th>Message</th>
              <th>Avg (ms)</th>
              <th>Δ vs prev</th>
              <th>Tests</th>
              <th>Run</th>
            </tr>
          </thead>
          <tbody>
            ${commitRowsFiltered.map(
              (row) => html`<tr>
                <td>${row.commitDate.toISOString().slice(0, 10)}</td>
                <td><a href="${row.htmlUrl}">${row.commitShortSha}</a></td>
                <td>${row.authorName ?? "n/a"}</td>
                <td class="truncate" title=${row.message}>${row.message || "(no message)"}</td>
                <td>${row.avgTotalMs != null ? row.avgTotalMs.toFixed(3) : "n/a"}</td>
                <td class=${row.deltaMs == null ? "muted" : row.deltaMs <= 0 ? "improved" : "regressed"}>
                  ${row.deltaMs == null ? "—" : `${row.deltaMs > 0 ? "+" : ""}${row.deltaMs.toFixed(3)} ms (${row.deltaPct > 0 ? "+" : ""}${row.deltaPct.toFixed(1)}%)`}
                </td>
                <td>${row.tests ?? "n/a"}</td>
                <td>
                  ${row.selectedBuildRun
                    ? html`<a href="${row.selectedBuildRun.htmlUrl}">#${row.selectedBuildRun.id}</a>`
                    : html`<span class="muted">n/a</span>`}
                </td>
              </tr>`
            )}
          </tbody>
        </table>`
      : html`<div class="muted">No commits match the current filter.</div>`}
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

.commit-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.commit-table th,
.commit-table td {
  border-bottom: 1px solid var(--theme-foreground-faint);
  padding: 0.5rem;
  text-align: left;
  vertical-align: top;
}

.truncate {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.improved {
  font-weight: 600;
}

.regressed {
  font-weight: 600;
}

</style>
