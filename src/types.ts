export type HexColor = `#${string}`;
type Surface = "base" | "raised" | "sunken" | "overlay";
type Text = "primary" | "secondary" | "muted" | "onAccent";
type Accent = "base" | "hover" | "subtle";
type Border = "subtle" | "strong" | "focus";
type Status = "positive" | "negative" | "warning" | "info";
type Chart = "grid" | "axis" | "tooltipBg";
export type CoreColorPath =
  | `color.surface.${Surface}`
  | `color.text.${Text}`
  | `color.accent.${Accent}`
  | `color.border.${Border}`
  | `color.status.${Status}`
  | `color.chart.${Chart}`
  | `color.chart.series.${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`;
export type CoreLengthPath = `radius.${"sm" | "md" | "lg" | "pill"}`;
export type ProductTokenSpec = Record<
  string,
  | { readonly type: "color"; readonly defaultFrom: CoreColorPath }
  | { readonly type: "length"; readonly defaultFrom: CoreLengthPath }
>;
declare const issued: unique symbol;
export interface ProductTokens<T extends ProductTokenSpec = ProductTokenSpec> {
  readonly [issued]: T;
}
// Distributes over the descriptor union so a widened spec yields
// `HexColor | number` instead of collapsing every token to `number`.
type ProductValue<S> = S extends { readonly type: "color" }
  ? HexColor
  : S extends { readonly type: "length" }
    ? number
    : never;
type ProductValues<T extends ProductTokenSpec> = {
  readonly [K in keyof T]: ProductValue<T[K]>;
};
type FontStackId = "system-sans" | "system-serif" | "system-mono";
export interface Theme {
  schemaVersion: 1;
  id: string;
  name: string;
  mode: "light" | "dark";
  color: {
    surface: Record<Surface, HexColor>;
    text: Record<Text, HexColor>;
    accent: Record<Accent, HexColor>;
    border: Record<Border, HexColor>;
    status: Record<Status, HexColor>;
    chart: Record<Chart, HexColor> & {
      series: [
        HexColor,
        HexColor,
        HexColor,
        HexColor,
        HexColor,
        HexColor,
        HexColor,
        HexColor,
      ];
    };
  };
  radius: Record<"sm" | "md" | "lg" | "pill", number>;
  font: {
    body: FontStackId;
    heading: FontStackId;
    mono: "system-mono";
    scale: number;
  };
  density: "compact" | "comfortable" | "spacious";
  product?: Record<string, HexColor | number>;
}
type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
export type ValidatedTheme<T extends ProductTokenSpec = Record<never, never>> =
  DeepReadonly<Omit<Theme, "product">> & { readonly product: ProductValues<T> };
export interface Diagnostic {
  code: string;
  path: string;
  message: string;
}
export interface ContrastPairReport {
  foregroundPath: CoreColorPath;
  backgroundPath: CoreColorPath;
  backdropPath: CoreColorPath;
  ratio: number;
  minimum: number;
  pass: boolean;
  policy: "required" | "advisory";
  suggestion: string;
}
export interface ValidationResult<
  T extends ProductTokenSpec = Record<never, never>,
> {
  ok: boolean;
  theme: ValidatedTheme<T> | null;
  errors: Diagnostic[];
  warnings: Diagnostic[];
  contrast: ContrastPairReport[];
}
