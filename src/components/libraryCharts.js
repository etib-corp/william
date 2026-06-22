import * as Plot from "npm:@observablehq/plot";
import * as d3 from "npm:d3";

// Return the most recent row for each library.
function latestByLibrary(data) {
  return Array.from(
    d3.group(data, (d) => d.library),
    ([, rows]) => rows.sort((a, b) => String(a.month).localeCompare(String(b.month))).at(-1)
  );
}

const metricLabels = {
  binarySize: "Binary size (KB)",
  compileTime: "Compile time (ms)",
  runtimeLatency: "Runtime latency (ms)",
  dependencyCount: "Dependencies",
  memoryUsage: "Memory (MB)",
  buildTime: "Build time (ms)"
};

export function binarySizeChart(data, {width} = {}) {
  const latest = latestByLibrary(data);
  return Plot.plot({
    title: "Latest binary size (KB)",
    width,
    height: 300,
    x: {label: "Library", domain: latest.sort((a, b) => b.binarySize - a.binarySize).map((d) => d.library)},
    y: {grid: true, label: "Binary size (KB)"},
    color: {legend: true},
    marks: [
      Plot.ruleY([0]),
      Plot.barY(latest, {x: "library", y: "binarySize", fill: "library", tip: true})
    ]
  });
}

export function conanDownloadsTrendChart(data, {width} = {}) {
  return Plot.plot({
    title: "Monthly Conan downloads trend",
    width,
    height: 300,
    x: {label: "Month"},
    y: {grid: true, label: "Downloads (millions)"},
    color: {legend: true},
    marks: [
      Plot.ruleY([0]),
      Plot.lineY(data, {x: "month", y: "conanDownloads", stroke: "library", tip: true})
    ]
  });
}

export function performanceScatter(data, {width} = {}) {
  const latest = latestByLibrary(data);
  return Plot.plot({
    title: "Compile time vs runtime latency",
    width,
    height: 300,
    x: {label: "Compile time (ms)"},
    y: {label: "Runtime latency (ms)"},
    color: {legend: true},
    marks: [
      Plot.dot(latest, {x: "compileTime", y: "runtimeLatency", stroke: "library", r: 8, tip: true}),
      Plot.linearRegressionY(latest, {x: "compileTime", y: "runtimeLatency", stroke: "var(--theme-foreground-muted)"})
    ]
  });
}

export function coverageChart(data, {width} = {}) {
  const latest = latestByLibrary(data);
  return Plot.plot({
    title: "Test coverage (%)",
    width,
    height: 300,
    x: {label: "Library", domain: latest.sort((a, b) => b.testCoverage - a.testCoverage).map((d) => d.library)},
    y: {grid: true, label: "Coverage (%)"},
    color: {legend: true},
    marks: [
      Plot.ruleY([0]),
      Plot.barY(latest, {x: "library", y: "testCoverage", fill: "library", tip: true}),
      Plot.ruleY([80], {stroke: "var(--theme-foreground-muted)", strokeDasharray: "4,4"})
    ]
  });
}

export function libraryTrendChart(data, library, {width} = {}) {
  const libData = data
    .filter((d) => d.library === library)
    .sort((a, b) => String(a.month).localeCompare(String(b.month)));
  const baseline = libData[0];
  const metrics = ["binarySize", "compileTime", "runtimeLatency", "memoryUsage"];
  const long = [];
  for (const d of libData) {
    for (const m of metrics) {
      long.push({version: String(d.version), metric: m, value: (d[m] / baseline[m]) * 100});
    }
  }
  return Plot.plot({
    title: `${library} relative performance (baseline = 100)`,
    width,
    height: 320,
    x: {label: "Version", tickRotate: -45, type: "point"},
    y: {grid: true, label: "Index (baseline = 100)"},
    color: {legend: true},
    marks: [
      Plot.ruleY([100], {stroke: "var(--theme-foreground-muted)", strokeDasharray: "4,4"}),
      Plot.lineY(long, {x: "version", y: "value", stroke: "metric", tip: true, marker: "dot"})
    ]
  });
}

export function comparisonHeatmap(data, {width} = {}) {
  const metrics = ["binarySize", "compileTime", "runtimeLatency", "dependencyCount", "memoryUsage", "buildTime"];
  const latest = latestByLibrary(data);
  const maxes = new Map(metrics.map((m) => [m, d3.max(latest, (d) => d[m])]));
  const normalized = [];
  for (const d of latest) {
    for (const m of metrics) {
      normalized.push({library: d.library, metric: m, value: d[m] / maxes.get(m)});
    }
  }
  return Plot.plot({
    title: "Relative performance heatmap (normalized to largest value)",
    width,
    height: 320,
    x: {label: "Library"},
    y: {label: "Metric"},
    color: {scheme: "YlOrRd", label: "Relative value"},
    marks: [
      Plot.cell(normalized, {x: "library", y: "metric", fill: "value", tip: true, inset: 2}),
      Plot.text(normalized, {
        x: "library",
        y: "metric",
        text: (d) => d.value.toFixed(2),
        fill: (d) => (d.value > 0.5 ? "white" : "black"),
        fontSize: 10
      })
    ]
  });
}

export function metricTrendComparison(data, library, metric, {width} = {}) {
  const filtered = data.filter((d) => d.library === library).sort((a, b) => String(a.month).localeCompare(String(b.month)));
  return Plot.plot({
    title: `${library} — ${metricLabels[metric] || metric} over time`,
    width,
    height: 300,
    x: {label: "Month"},
    y: {grid: true, label: metricLabels[metric] || metric},
    marks: [
      Plot.ruleY([0]),
      Plot.lineY(filtered, {x: "month", y: metric, tip: true}),
      Plot.dot(filtered, {x: "month", y: metric, fill: "var(--theme-foreground-focus)", r: 2, tip: true})
    ]
  });
}
