// Synthetic contrast fixtures, not curated/shared product palettes.
export function theme(mode = "light") {
  const bg = mode === "light" ? "#FFFFFF" : "#000000";
  const fg = mode === "light" ? "#000000" : "#FFFFFF";
  return {
    schemaVersion: 1,
    id: "test-theme",
    name: "Synthetic test",
    mode,
    color: {
      surface: { base: bg, raised: bg, sunken: bg, overlay: "#00000000" },
      text: { primary: fg, secondary: fg, muted: fg, onAccent: bg },
      accent: { base: fg, hover: fg, subtle: "#00000000" },
      border: { subtle: bg, strong: fg, focus: fg },
      status: { positive: fg, negative: fg, warning: fg, info: fg },
      chart: { series: Array(8).fill(fg), grid: bg, axis: fg, tooltipBg: bg },
    },
    radius: { sm: 0, md: 8, lg: 64, pill: 999 },
    font: {
      body: "system-sans",
      heading: "system-serif",
      mono: "system-mono",
      scale: 1,
    },
    density: "comfortable",
  };
}
export function set(object, path, value) {
  const keys = path.split(".");
  const leaf = keys.pop();
  let parent = object;
  for (const key of keys) parent = parent[key];
  parent[leaf] = value;
  return object;
}
export const json = (value) => JSON.stringify(value);
