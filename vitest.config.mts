import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for src/lib and the odd shared component (rendered with
// react-dom/server). They run in node: several lib modules read the
// repository at import (lib/chrome lists public/img/chrome).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
