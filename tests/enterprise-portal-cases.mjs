import { portalAliasDeclarations } from "../dist/enterprise-portal.js";
import { validated } from "./css-cases.mjs";
import { theme } from "./fixtures.mjs";

// Klar's literal values for the eight tokens the theme schema has no field for.
export const klarHost = () => ({
  fontSize: "0.875rem",
  space1: "0.25rem",
  space2: "0.5rem",
  space3: "0.75rem",
  space4: "1rem",
  borderWidth: "1px",
  borderStyle: "solid",
  shadow: "0 1px 3px rgb(0 0 0 / 20%)",
});
export const portalSnapshotFile = "portal-alias-declarations.css";
export const portalSnapshot = (mode = "light") =>
  portalAliasDeclarations(validated(theme(mode)), klarHost());
