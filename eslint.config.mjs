import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disable ESLint rules that conflict with Prettier formatting.
  // Prettier handles all stylistic rules; ESLint focuses on logic/correctness.
  prettier,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "next-env.d.ts",
    ".docs/**",
    "archive/**",
    "archive-utf8/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
