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
  // Colours live in src/styles/ (tokens.css, skins.css): a hex value inside
  // a class string (`bg-[#e0e0e0]`, `[color:#fff]`, also in a string
  // constant) is a colour that bypassed them. Name it there and use the
  // utility; text that only mentions such a class can disable the rule on
  // its line.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\[(?:[a-z-]+:)?#[0-9a-fA-F]{3,8}\\]/]",
          message:
            "Name this colour in src/styles/ (tokens.css or skins.css) instead of an arbitrary hex class.",
        },
        {
          selector: "TemplateElement[value.raw=/\\[(?:[a-z-]+:)?#[0-9a-fA-F]{3,8}\\]/]",
          message:
            "Name this colour in src/styles/ (tokens.css or skins.css) instead of an arbitrary hex class.",
        },
      ],
    },
  },
  // The scripts /site/ documents carry (src/app/site/_render/assets.ts reads
  // them): plain browser scripts, inserted as they are, so undefined and
  // unused names are errors here rather than in a visitor's console.
  // The scripts the content pages run in place of React (public/scripts/):
  // the same checks, in the browser's current syntax.
  {
    files: ["public/scripts/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        Element: "readonly",
      },
    },
    rules: { "no-undef": "error", "no-unused-vars": "error" },
  },
  // The era script the layout inlines with these three values (src/app/layout.tsx).
  {
    files: ["src/app/_scripts/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        document: "readonly",
        window: "readonly",
        localStorage: "readonly",
        Element: "readonly",
        ERA_STORAGE_KEY: "readonly",
        ERA_HINT_KEY: "readonly",
        ERAS: "readonly",
      },
    },
    rules: { "no-undef": "error", "no-unused-vars": "error" },
  },
  {
    files: ["src/app/site/_render/assets/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { document: "readonly", window: "readonly" },
    },
    rules: { "no-undef": "error", "no-unused-vars": "error" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "dist-search/**",
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
