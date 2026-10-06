#!/usr/bin/env node
/**
 * Tell the IndexNow search engines (Bing, Naver, Yandex, Seznam and others,
 * which share submissions through api.indexnow.org) every address in
 * `out/sitemap.xml` at once. Google does not take IndexNow; it reads the
 * sitemap named in robots.txt and in Search Console.
 *
 * The key is public by design: an engine fetches `https://forg.co.kr/{key}.txt`
 * (`public/`) and compares it with the key in the request
 * (indexnow.org/documentation). The script checks that file first, so a
 * submission is never sent before forg.co.kr serves this build.
 *
 * Usage:
 *   pnpm build                 # writes out/sitemap.xml
 *   pnpm indexnow --dry-run    # count the addresses and requests, send nothing
 *   pnpm indexnow              # submit
 */

import { readFileSync } from "node:fs";

const KEY = "dbc51e2864d29518b3c09ce7c623131a";
const HOST = "forg.co.kr";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/indexnow";
/** The protocol's limit on addresses per request. */
const BATCH = 10_000;
const DRY_RUN = process.argv.includes("--dry-run");

const xml = readFileSync("out/sitemap.xml", "utf8");
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replaceAll("&amp;", "&"));
const foreign = urls.filter((u) => !u.startsWith(`https://${HOST}/`));
if (foreign.length > 0) {
  console.error(`[indexnow] ${foreign.length} addresses are not on ${HOST}, e.g. ${foreign[0]}`);
  process.exit(1);
}

const batches = [];
for (let i = 0; i < urls.length; i += BATCH) batches.push(urls.slice(i, i + BATCH));
console.log(`[indexnow] ${urls.length} addresses in ${batches.length} request(s)`);
if (DRY_RUN) process.exit(0);

const served = await fetch(KEY_LOCATION).then(
  async (r) => (r.ok ? (await r.text()).trim() : null),
  () => null,
);
if (served !== KEY) {
  console.error(`[indexnow] ${KEY_LOCATION} does not serve the key yet; deploy first`);
  process.exit(1);
}

for (const [i, urlList] of batches.entries()) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  });
  // 200 and 202 are accepted; 403 the key did not match, 422 an address is
  // not on the host, 429 too many requests.
  console.log(`[indexnow] request ${i + 1}: ${res.status} ${res.statusText}`);
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}
