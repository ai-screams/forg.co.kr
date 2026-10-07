#!/usr/bin/env node
/**
 * Tell the IndexNow search engines (Bing, Naver, Yandex, Seznam and others,
 * which share submissions through api.indexnow.org) every address in
 * `out/sitemap.xml` at once. Google does not take IndexNow; it reads the
 * sitemap named in robots.txt and in Search Console.
 *
 * The key is public by design: an engine fetches `https://forg.co.kr/{key}.txt`
 * (`public/`) and compares it with the key in the request
 * (indexnow.org/documentation). Before sending, the script checks that
 * forg.co.kr serves the key and the same sitemap as `out/`, so a submission
 * never runs ahead of the deploy. IndexNow asks for changed addresses: the
 * whole sitemap suits the first submission; later ones can pass
 * `--only-new <old sitemap.xml>` to send what that one lacked.
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

function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replaceAll("&amp;", "&"));
}

const xml = readFileSync("out/sitemap.xml", "utf8");
const onlyNew = process.argv.indexOf("--only-new");
const known =
  onlyNew > 0 ? new Set(locs(readFileSync(process.argv[onlyNew + 1], "utf8"))) : new Set();
const urls = locs(xml).filter((u) => !known.has(u));
const foreign = urls.filter((u) => !u.startsWith(`https://${HOST}/`));
if (foreign.length > 0) {
  console.error(`[indexnow] ${foreign.length} addresses are not on ${HOST}, e.g. ${foreign[0]}`);
  process.exit(1);
}

const batches = [];
for (let i = 0; i < urls.length; i += BATCH) batches.push(urls.slice(i, i + BATCH));
console.log(`[indexnow] ${urls.length} addresses in ${batches.length} request(s)`);
if (DRY_RUN) process.exit(0);

async function text(url) {
  return fetch(url).then(
    async (r) => (r.ok ? (await r.text()).trim() : null),
    () => null,
  );
}

if ((await text(KEY_LOCATION)) !== KEY) {
  console.error(`[indexnow] ${KEY_LOCATION} does not serve the key yet; deploy first`);
  process.exit(1);
}
if ((await text(`https://${HOST}/sitemap.xml`)) !== xml.trim()) {
  console.error(
    `[indexnow] https://${HOST}/sitemap.xml differs from out/sitemap.xml; deploy this build first`,
  );
  process.exit(1);
}

function send(urlList) {
  return fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  });
}

for (const [i, urlList] of batches.entries()) {
  let res = await send(urlList);
  if (res.status === 429) {
    // Too many requests: wait as told (a minute if not told), then once more.
    const wait = Number(res.headers.get("retry-after")) || 60;
    console.log(`[indexnow] request ${i + 1}: 429, again in ${wait}s`);
    await new Promise((ok) => setTimeout(ok, wait * 1000));
    res = await send(urlList);
  }
  // 200 and 202 are accepted; 403 the key did not match, 422 an address is
  // not on the host.
  console.log(`[indexnow] request ${i + 1}: ${res.status} ${res.statusText}`);
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}
