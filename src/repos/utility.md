---
theme: dashboard
title: Utility - GTest Performance
toc: false
---

# Utility performance deltas

```js
const runData = FileAttachment("../data/gtest-utility.json").json();
```

```js
const commitRows = (runData.actions?.commits ?? [])
  .map((entry) => {
    const commitDate = entry.commit?.authorDate ? new Date(entry.commit.authorDate) : null;
    if (!commitDate || Number.isNaN(+commitDate)) return null;

    const platforms = entry.performance?.platforms ?? [];

    return {
      commitSha: entry.commit.sha,
      commitShortSha: entry.commit.sha?.slice(0, 7),
      commitDate,
      authorName: entry.commit.authorName,
      message: String(entry.commit.message ?? "").split("\n")[0],
      htmlUrl: entry.commit.htmlUrl,
      totalMs: platforms.length ? d3.sum(platforms, (d) => d.totalMs) : null,
      tests: platforms.length ? d3.max(platforms, (d) => d.tests) : null,
      selectedBuildRun: entry.selectedBuildRun
    };
  })
  .filter(Boolean)
  .sort((a, b) => d3.descending(a.commitDate, b.commitDate))
  .map((row, index, rows) => {
    const previous = rows[index + 1];
    const deltaMs = previous?.totalMs != null && row.totalMs != null ? row.totalMs - previous.totalMs : null;
    const deltaPct = previous?.totalMs ? (deltaMs / previous.totalMs) * 100 : null;
    return {...row, deltaMs, deltaPct};
  });

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

<div class="grid grid-cols-1">
  <div class="card">
    <h2>Commit-to-commit time differences (all performance tests)</h2>
    <div class="muted">Showing ${commitRowsFiltered.length} of ${commitRows.length} commits</div>
    ${commitRowsFiltered.length > 0
      ? html`<table class="commit-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Commit</th>
              <th>Author</th>
              <th>Message</th>
              <th>Total (ms)</th>
              <th>Δ vs prev</th>
              <th>Tests (unique)</th>
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
                <td>${row.totalMs != null ? row.totalMs.toFixed(3) : "n/a"}</td>
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

<div class="card">
  Data source: commit
  <a href="https://github.com/etib-corp/utility/commit/${runData.source.commitSha}">${runData.source.commitSha.slice(0, 12)}</a>
  → ${runData.actions?.selectedBuildRun ? html`run <a href="${runData.actions.selectedBuildRun.htmlUrl}">#${runData.actions.selectedBuildRun.id}</a>` : "local snapshot"}
  (${runData.source.mode}) fetched at ${runData.source.fetchedAt}.
</div>

<style>
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

.improved,
.regressed {
  font-weight: 600;
}
</style>
