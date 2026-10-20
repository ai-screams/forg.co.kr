import { readFileSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { versioned } from "@/lib/chrome";
import { DEFAULT_ERA, ERA_HINT_KEY, ERA_STORAGE_KEY, ERAS } from "@/lib/era";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";

import "./globals.css";

// The defaults a page without its own keeps. No canonical here: a page that
// set none would inherit the home page's (`pageMeta` in src/lib/seo.ts).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "forg.co.kr — 디지털 박물관",
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, locale: "ko_KR", type: "website", images: [OG_IMAGE] },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

/**
 * The era script (`_scripts/era.js`, read once at build), inlined at the
 * top of the head without its comment lines: it applies the saved era
 * before the page paints and handles the era buttons from the first click,
 * as the pages ship no React. It links the 2026 fonts while the era is 2026,
 * by a URL that carries the stylesheet's hash (`versioned`).
 */
const eraSource = readFileSync(
  path.join(process.cwd(), "src", "app", "_scripts", "era.js"),
  "utf8",
);
const eraScript = `(function (ERA_STORAGE_KEY, ERAS, ERA_HINT_KEY, FONTS_2026) {\n${eraSource.replace(/^\s*\/\/.*\n/gm, "")}})(${JSON.stringify(ERA_STORAGE_KEY)}, ${JSON.stringify(ERAS)}, ${JSON.stringify(ERA_HINT_KEY)}, ${JSON.stringify(versioned("/fonts/2026/2026.css"))});`;

export default function RootLayout({
  children,
  crumb,
}: Readonly<{ children: React.ReactNode; crumb: React.ReactNode }>) {
  return (
    /* `suppressHydrationWarning` covers exactly the attribute the script
       above rewrites: React would otherwise log a mismatch on every visit
       by someone whose stored era is not the default. It applies to this
       element's own attributes only, not to the tree below it. */
    <html lang="ko" data-era={DEFAULT_ERA} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: eraScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-(--era-page-bg)">
        {/* `crumb` (app/@crumb): a board list's name and notes, else nothing. */}
        <SiteHeader crumb={crumb} />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
