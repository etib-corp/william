# William

William is the metrics dashboard for the Xider project. It is built using the [Observable Framework](https://observablehq.com/framework), a framework for building data-driven web applications using Observable notebooks.

## Getting started

Clone this repository:

```bash
git clone <repository-url>
```

Install dependencies:

```bash
npm install
```

Then, to start the local preview server, run:

```bash
npm run dev
```

Visit <http://localhost:3000> to preview your app.

For more, see the [Observable Framework documentation](https://observablehq.com/framework/getting-started).

## Project structure

A typical Framework project looks like this:

```ini
.
├─ src
│  ├─ components
│  │  └─ timeline.js           # an importable module
│  ├─ data
│  │  ├─ launches.csv.js       # a data loader
│  │  └─ events.json           # a static data file
│  ├─ example-dashboard.md     # a page
│  ├─ example-report.md        # another page
│  └─ index.md                 # the home page
├─ .gitignore
├─ observablehq.config.js      # the app config file
├─ package.json
└─ README.md
```

**`src`** - This is the "source root" — where your source files live. Pages go here. Each page is a Markdown file. Observable Framework uses [file-based routing](https://observablehq.com/framework/project-structure#routing), which means that the name of the file controls where the page is served.

**`src/index.md`** - This is the home page for your app. You should always have a home page.

**`src/data`** - You can put [data loaders](https://observablehq.com/framework/data-loaders) or static data files here.

**`src/components`** - You can put shared [JavaScript modules](https://observablehq.com/framework/imports) here. This helps you reuse code across pages and share code with vanilla web applications.

**`observablehq.config.js`** - This is the [app configuration](https://observablehq.com/framework/config) file for sidebar navigation and app title.

## Command reference

| Command | Description |
| --------- | ------------- |
| `npm install` | Install or reinstall dependencies |
| `npm run dev` | Start local preview server |
| `npm run build` | Build your static site, generating `./dist` |
| `npm run deploy` | Deploy your app to Observable |
| `npm run clean` | Clear the local data loader cache |
| `npm run observable` | Run commands like `observable help` |
