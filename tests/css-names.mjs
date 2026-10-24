// Core names in emission order, with the open prefix written as <P>. Must
// equal the table in docs/css-serialisation.md and ADR-themes-0002 item 3.
const group = (path, leaves) => leaves.map((leaf) => `--<P>-${path}-${leaf}`);
export const coreNames = [
  "color-scheme",
  ...group("color-surface", ["base", "raised", "sunken", "overlay"]),
  ...group("color-text", ["primary", "secondary", "muted", "on-accent"]),
  ...group("color-accent", ["base", "hover", "subtle"]),
  ...group("color-border", ["subtle", "strong", "focus"]),
  ...group("color-status", ["positive", "negative", "warning", "info"]),
  ...group("color-chart", ["grid", "axis", "tooltip-bg"]),
  ...group("color-chart-series", ["0", "1", "2", "3", "4", "5", "6", "7"]),
  ...group("radius", ["sm", "md", "lg", "pill"]),
  ...group("font", ["body", "heading", "mono", "scale"]),
  "--<P>-density-scale",
];
