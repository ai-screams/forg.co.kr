/** @type {import("@commitlint/types").UserConfig} */
const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Slightly more permissive subject length for descriptive commits
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [2, "always", 120],
  },
};

export default config;
