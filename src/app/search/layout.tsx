/**
 * The search page's metadata: `page.tsx` is a client component, which cannot
 * export any. Search result pages stay out of search engines (Google's
 * guidance for internal search), while their links are still followed.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "검색 — forg.co.kr",
  robots: { index: false, follow: true },
  alternates: { canonical: "/search/" },
};

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children;
}
