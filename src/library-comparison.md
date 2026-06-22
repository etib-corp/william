---
theme: dashboard
title: C++ Library comparison
toc: false
---

# C++ Library comparison

```js
const libraries = FileAttachment("data/libraries.csv").csv({typed: true});
```

```js
import {comparisonHeatmap, metricTrendComparison} from "./components/libraryCharts.js";
```

```js
const libraryNames = [...new Set(libraries.map((d) => d.library))].sort();
const latest = Array.from(
  d3.group(libraries, (d) => d.library),
  ([, rows]) => rows.sort((a, b) => String(a.month).localeCompare(String(b.month))).at(-1)
);
const metricNames = ["binarySize", "compileTime", "runtimeLatency", "dependencyCount", "memoryUsage", "buildTime"];
const metricLabels = {
  binarySize: "Binary size (KB)",
  compileTime: "Compile time (ms)",
  runtimeLatency: "Runtime latency (ms)",
  dependencyCount: "Dependencies",
  memoryUsage: "Memory (MB)",
  buildTime: "Build time (ms)"
};
```

## Select library and versions

```js
const selectedLib = view(Inputs.select(libraryNames, {label: "Library", value: libraryNames[0]}));
const versionsByLib = libraries.filter((d) => d.library === selectedLib).sort((a, b) => String(a.month).localeCompare(String(b.month))).map((d) => d.version);
const versionA = view(Inputs.select(versionsByLib, {label: "Version A", value: versionsByLib.at(-2)}));
const versionB = view(Inputs.select(versionsByLib, {label: "Version B", value: versionsByLib.at(-1)}));
const compareMetric = view(Inputs.select(metricNames, {label: "Metric", value: "binarySize", format: (d) => metricLabels[d]}));
```

```js
const a = libraries.find((d) => d.library === selectedLib && d.version === versionA) ?? {};
const b = libraries.find((d) => d.library === selectedLib && d.version === versionB) ?? {};
```

<!-- Side-by-side KPIs -->

<div class="grid grid-cols-2">
  <div class="card">
    <h2>${a.library ?? "—"} ${a.version ?? ""}</h2>
    <p><strong>Month:</strong> ${String(a.month ?? "—")}</p>
    <p><strong>Binary size:</strong> ${(a.binarySize ?? 0).toLocaleString("en-US")} KB</p>
    <p><strong>Compile time:</strong> ${(a.compileTime ?? 0).toLocaleString("en-US")} ms</p>
    <p><strong>Runtime latency:</strong> ${(a.runtimeLatency ?? 0).toLocaleString("en-US")} ms</p>
    <p><strong>Conan downloads:</strong> ${(a.conanDownloads ?? 0).toFixed(2)}M / month</p>
    <p><strong>Test coverage:</strong> ${a.testCoverage ?? "—"}%</p>
  </div>
  <div class="card">
    <h2>${b.library ?? "—"} ${b.version ?? ""}</h2>
    <p><strong>Month:</strong> ${String(b.month ?? "—")}</p>
    <p><strong>Binary size:</strong> ${(b.binarySize ?? 0).toLocaleString("en-US")} KB</p>
    <p><strong>Compile time:</strong> ${(b.compileTime ?? 0).toLocaleString("en-US")} ms</p>
    <p><strong>Runtime latency:</strong> ${(b.runtimeLatency ?? 0).toLocaleString("en-US")} ms</p>
    <p><strong>Conan downloads:</strong> ${(b.conanDownloads ?? 0).toFixed(2)}M / month</p>
    <p><strong>Test coverage:</strong> ${b.testCoverage ?? "—"}%</p>
  </div>
</div>

## Metric evolution over time

<div class="grid grid-cols-1">
  <div class="card">
    ${resize((width) => metricTrendComparison(libraries, selectedLib, compareMetric, {width}))}
  </div>
</div>

## All versions comparison table

```js
const libVersions = libraries
  .filter((d) => d.library === selectedLib)
  .sort((a, b) => String(a.month).localeCompare(String(b.month)))
  .map((d) => ({
    version: d.version,
    month: String(d.month),
    binarySize: d.binarySize,
    compileTime: d.compileTime,
    runtimeLatency: d.runtimeLatency,
    dependencyCount: d.dependencyCount,
    conanDownloads: d.conanDownloads.toFixed(2),
    testCoverage: d.testCoverage,
    memoryUsage: d.memoryUsage,
    buildTime: d.buildTime
  }));
```

${Inputs.table(libVersions)}

Data is generated mock data for demonstration purposes.
