import * as Plot from "npm:@observablehq/plot";

export function releaseTimeline(events, {width, height} = {}) {
  const data = events.map((d, i) => ({
    ...d,
    date: new Date(d.date),
    y: d.y ?? (i % 5) * 12 + 10
  }));
  return Plot.plot({
    width,
    height,
    marginTop: 30,
    x: {label: null},
    y: {axis: null},
    marks: [
      Plot.ruleX(data, {x: "date", y: "y", markerEnd: "dot", strokeWidth: 2.5}),
      Plot.ruleY([0]),
      Plot.text(data, {
        x: "date",
        y: "y",
        text: (d) => `${d.library} ${d.version}`,
        lineAnchor: "bottom",
        dy: -10,
        lineWidth: 12,
        fontSize: 12
      })
    ]
  });
}
