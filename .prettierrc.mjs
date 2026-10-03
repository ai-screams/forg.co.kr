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
  // The theme the class sorter reads: without it, our tokens (`bg-forg-gold`,
  // `bg-zb40-rule`) and the `frame:` variant are unknown and sorted first.
  tailwindStylesheet: "./src/app/globals.css",
};

export default config;
