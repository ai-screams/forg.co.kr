/** @type {import("prettier").Config} */
const config = {
  // Style
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  useTabs: false,
  trailingComma: "all",
  printWidth: 100,
  bracketSameLine: false,
  arrowParens: "always",
  endOfLine: "lf",

  // Plugins (order matters: organize-imports first, tailwind LAST)
  plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
};

export default config;
