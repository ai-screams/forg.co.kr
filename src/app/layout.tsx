import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { DEFAULT_ERA, ERA_STORAGE_KEY } from "@/lib/era";

import "./globals.css";

export const metadata: Metadata = {
  title: "forg.co.kr — 디지털 박물관",
  description: "한국 울티마 온라인 최대 팬사이트 forg.co.kr (1999~2015) 재현 아카이브",
};

/**
 * Hydration 전에 저장된 시기를 <html data-era>에 적용 → FOUC 방지.
 * `dangerouslySetInnerHTML`로 인라인 삽입한다.
 */
const noFlashScript = `
(function() {
  try {
    var saved = localStorage.getItem(${JSON.stringify(ERA_STORAGE_KEY)});
    if (saved === '2003' || saved === '2014') {
      document.documentElement.dataset.era = saved;
    }
  } catch (_) {
    /* private mode 등 — 기본 시기 유지 */
  }
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-era={DEFAULT_ERA} className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-(--era-page-bg)">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
