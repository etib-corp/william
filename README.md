# C++ Library Performance Dashboard

This is an [Observable Framework](https://observablehq.com/framework/) app that tracks mock C++ library performance metrics across time.

## Getting started

Install dependencies:

```
npm install
```

Start the local preview server:

```
npm run dev
```

Then visit <http://localhost:3000> to preview your app.

## What's inside

- **Dashboard** (`/`) — high-level KPI cards and charts showing binary size, Conan downloads, compile/runtime latency, and test coverage.
- **Comparison** (`/library-comparison`) — side-by-side C++ library comparison with a normalized heatmap and metric trend lines.
- **Timeline** (`/timeline`) — release milestone timeline.

Data is generated as mock data by the data loader in `src/data/libraries.csv.js` and the static file `src/data/releases.json`.

## Project structure

```ini
.
├─ src
│  ├─ components
│  │  ├─ libraryCharts.js      # shared Plot chart helpers
│  │  └─ timeline.js           # release timeline component
│  ├─ data
│  │  ├─ libraries.csv.js     # data loader: mock C++ library metrics
│  │  └─ releases.json        # static release milestones
│  ├─ index.md                # home dashboard page
│  ├─ library-comparison.md   # comparison page
│  └─ timeline.md             # release timeline page
├─ observablehq.config.js     # app config
├─ package.json
└─ README.md
```

## Command reference

| Command           | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `npm install`            | Install or reinstall dependencies                        |
| `npm run dev`        | Start local preview server                               |
| `npm run build`      | Build your static site, generating `./dist`              |
| `npm run deploy`     | Deploy your app to Observable                            |
| `npm run clean`      | Clear the local data loader cache                        |
| `npm run observable` | Run commands like `observable help`                      |
