// Tighten TypeScript's built-in types.
// See: https://github.com/total-typescript/ts-reset
//
// Effects in this project:
// - JSON.parse() returns `unknown` instead of `any`
// - Array.prototype.filter(Boolean) properly narrows out null/undefined
// - fetch().json() returns `unknown`
// - localStorage.getItem returns `string | null` (already correct, reaffirmed)
import "@total-typescript/ts-reset";
