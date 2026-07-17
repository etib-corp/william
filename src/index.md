---
theme: dashboard
title: C++ Library Performance Dashboard
toc: false
---

# C++ Library Performance Dashboard

```js
const libraries = FileAttachment("data/libraries.csv").csv({typed: true});
```

```js
import {
  binarySizeChart,
  conanDownloadsTrendChart,
  coverageChart,
  libraryTrendChart,
  performanceScatter
} from "./components/libraryCharts.js";
```

```js
const libraryNames = [...new Set(libraries.map((d) => d.library))].sort();
const latest = Array.from(
  d3.group(libraries, (d) => d.library),
  ([, rows]) => rows.sort((a, b) => String(a.month).localeCompare(String(b.month))).at(-1)
);
const totalLibraries = latest.length;
const avgBinary = d3.mean(latest, (d) => d.binarySize);
const avgCoverage = d3.mean(latest, (d) => d.testCoverage);
const topLibrary = latest.reduce((a, b) => (a.conanDownloads > b.conanDownloads ? a : b));
```

<!-- KPI cards -->

<div class="grid grid-cols-3">
  <div class="card">
    <h2>Libraries tracked</h2>
    <span class="big">${totalLibraries}</span>
  </div>
  <div class="card">
    <h2>Average binary size</h2>
    <span class="big">${avgBinary.toFixed(1)} KB</span>
  </div>
  <div class="card">
    <h2>Average test coverage</h2>
    <span class="big">${avgCoverage.toFixed(1)}%</span>
  </div>
</div>

<!-- Main charts -->

<div class="grid grid-cols-2" style="grid-auto-rows: 420px;">
  <div class="card">${resize((width) => binarySizeChart(libraries, {width}))}</div>
  <div class="card">${resize((width) => conanDownloadsTrendChart(libraries, {width}))}</div>
  <div class="card">${resize((width) => performanceScatter(libraries, {width}))}</div>
  <div class="card">${resize((width) => coverageChart(libraries, {width}))}</div>
</div>

## Library deep dive

```js
const selectedLibrary = view(Inputs.select(libraryNames, {label: "Library", value: libraryNames[0]}));
```

<!-- Use a 2-row tall card so the rotated x-axis fits -->
<div class="grid grid-cols-1" style="grid-auto-rows: 520px;">
  <div class="card">
    ${resize((width) => libraryTrendChart(libraries, selectedLibrary, {width}))}
  </div>
</div>

Data is generated mock data for demonstration purposes.
