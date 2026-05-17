import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Existing client utilities intentionally hydrate browser-only state
      // after mount; keep compiler diagnostics visible without blocking lint.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "archive/**",
    "coverage/**",
    "data/**/*.db",
    "dist/**",
    "next-env.d.ts",
    "out/**",
    "playwright-report/**",
    "test-results/**",
    "*.tsbuildinfo",
  ]),
]);
