import {csvFormat} from "d3-dsv";

// Deterministic seeded random number generator so the mock data is stable
// across builds and still looks realistic.
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20240622);

// C++ library baseline characteristics.
const libraries = [
  {name: "fmt", baseBinary: 120, baseCompile: 180, baseRuntime: 12, baseDeps: 0, baseDownloads: 5.2, baseIssues: 320, baseStars: 19.8, baseCoverage: 93, baseMemory: 8, baseBuild: 2400},
  {name: "spdlog", baseBinary: 280, baseCompile: 350, baseRuntime: 18, baseDeps: 1, baseDownloads: 3.8, baseIssues: 450, baseStars: 15.2, baseCoverage: 89, baseMemory: 14, baseBuild: 4100},
  {name: "abseil", baseBinary: 1850, baseCompile: 2600, baseRuntime: 45, baseDeps: 0, baseDownloads: 2.1, baseIssues: 980, baseStars: 14.7, baseCoverage: 91, baseMemory: 42, baseBuild: 12800},
  {name: "boost", baseBinary: 6400, baseCompile: 8200, baseRuntime: 110, baseDeps: 4, baseDownloads: 1.6, baseIssues: 760, baseStars: 13.9, baseCoverage: 88, baseMemory: 78, baseBuild: 34200}
];

const months = [];
for (let year = 2022; year <= 2024; year++) {
  for (let month = 1; month <= 12; month++) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
}

// Per-library starting major.minor versions for realistic mock data.
const baseVersions = {
  fmt: [8, 0],
  spdlog: [1, 9],
  abseil: [2021, 0],
  boost: [1, 78]
};

function versionFor(lib, monthIndex) {
  const [maj, min] = baseVersions[lib];
  if (lib === "abseil") {
    // Abseil uses yearly release numbers (e.g. 202101, 202102, ...).
    const year = 2021 + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    return `${year}${String(month).padStart(2, "0")}`;
  }
  if (lib === "boost") {
    // Boost uses major.minor (e.g. 1.78.0, 1.79.0, ...).
    return `${maj}.${min + monthIndex}.0`;
  }
  return `${maj}.${min}.${monthIndex}`;
}

const rows = [];
months.forEach((month, i) => {
  libraries.forEach((lib) => {
    const growth = lib.name === "boost" ? 1.01 : 1.015;
    const trend = Math.pow(growth, i);
    const noise = () => 0.9 + rand() * 0.2;

    rows.push({
      month,
      library: lib.name,
      version: versionFor(lib.name, i),
      binarySize: Math.round(lib.baseBinary * trend * noise()),
      compileTime: Math.round(lib.baseCompile * noise()),
      runtimeLatency: Math.round(lib.baseRuntime * noise()),
      dependencyCount: Math.max(0, lib.baseDeps + Math.round((rand() - 0.5) * 2)),
      conanDownloads: Math.round(lib.baseDownloads * trend * noise() * 100) / 100,
      openIssues: Math.round(lib.baseIssues * noise()),
      stars: Math.round(lib.baseStars * Math.pow(1.005, i) * 10) / 10,
      testCoverage: Math.round(Math.min(100, lib.baseCoverage + (rand() - 0.5) * 2)),
      memoryUsage: Math.round(lib.baseMemory * noise() * 10) / 10,
      buildTime: Math.round(lib.baseBuild * noise())
    });
  });
});

process.stdout.write(csvFormat(rows));
