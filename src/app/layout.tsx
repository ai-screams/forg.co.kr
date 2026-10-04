import { readFileSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DEFAULT_ERA, ERA_STORAGE_KEY, ERAS } from "@/lib/era";

import "./globals.css";

export const metadata: Metadata = {
  title: "forg.co.kr — 디지털 박물관",
  description: "한국 울티마 온라인 최대 팬사이트 forg.co.kr (1998–2016) 재현 아카이브",
};

/**
 * The era script (`_scripts/era.js`, read once at build), inlined at the
 * top of the head without its comment lines: it applies the saved era
 * before the page paints and handles the era buttons from the first click,
 * as the pages ship no React.
 */
const eraSource = readFileSync(
  path.join(process.cwd(), "src", "app", "_scripts", "era.js"),
  "utf8",
);
const eraScript = `(function (ERA_STORAGE_KEY, ERAS) {\n${eraSource.replace(/^\s*\/\/.*\n/gm, "")}})(${JSON.stringify(ERA_STORAGE_KEY)}, ${JSON.stringify(ERAS)});`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
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
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
