---
title: Release timeline
toc: false
---

# Release timeline

This timeline highlights major mock release milestones for the C++ libraries tracked by the dashboard.

```js
const releases = FileAttachment("data/releases.json").json();
```

```js
import {releaseTimeline} from "./components/timeline.js";
```

```js
releaseTimeline(releases, {height: 300})
```

## Milestones

```js
const sorted = releases.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
```

<ul>
${sorted.map((d) => html`<li><strong>${d.date}</strong> — ${d.library} ${d.version}: ${d.milestone}</li>`).join("\n")}
</ul>

Data is generated mock data for demonstration purposes.
