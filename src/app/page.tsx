/**
 * Museum landing — each era's front page inside the era frame
 * (`<EraShell>`, shared with every route): the 2014 eight-box grid
 * (`home-2014.tsx`), the 2003 main frame (`home-2003.tsx`) and the 2001
 * front page (`home-2001.tsx`). All three render server-side and
 * `<html data-era>` shows one (CSS in `src/styles/eras.css`), so the era toggle is
 * instant and the static export ships every layout.
 */

import type { Metadata } from "next";

import { EraShell } from "@/components/era-shell";
import { Home2001Content } from "@/components/home-2001";
import { Home2003Content } from "@/components/home-2003";
import { Home2014Content } from "@/components/home-2014";
import { JsonLd } from "@/components/json-ld";
import { pageMeta, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { websiteJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = pageMeta({
  title: "forg.co.kr — 디지털 박물관",
  shareTitle: SITE_NAME,
  description: SITE_DESCRIPTION,
  path: "/",
});

export default function HomePage() {
  return (
    <>
      {/* The site's name for search results (Google reads it from the home page). */}
      <JsonLd data={websiteJsonLd()} />
      <EraShell
        content2014={<Home2014Content />}
        content2003={<Home2003Content />}
        content2001={<Home2001Content />}
      />
    </>
  );
}
