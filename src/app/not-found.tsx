/**
 * The 404 page. Cloudflare Pages serves `out/404.html` for any path the
 * export did not write, so this is what a mistyped or retired address
 * shows. Without this file Next drew its own page: English, and with a
 * dark-mode style the museum does not have.
 *
 * Kept small and outside `<EraShell>`: every page's RSC payload carries the
 * root not-found tree (the root layout's `notFound`), so the three eras'
 * frames here would ride along on all 16,692 pages. Drawn like the search
 * page instead, inside the root layout's header and footer, with the same
 * white input box.
 */

import type { Metadata } from "next";

import Link from "@/components/link";

export const metadata: Metadata = {
  title: "찾는 쪽이 없습니다 — forg.co.kr",
};

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <div className="rounded-md border border-(--era-input-border) bg-(--era-content-bg) px-6 py-5 text-sm text-forg-ink">
        <h1 className="text-xl font-bold">찾는 쪽이 없습니다</h1>
        <p className="mt-1 text-xs text-forg-muted">
          주소가 틀렸거나 박물관에 남아 있지 않은 쪽입니다.
        </p>
        <form action="/search/" method="get" className="mt-4 flex gap-2">
          <input
            type="search"
            name="q"
            aria-label="검색어"
            placeholder="제목·본문·작성자·댓글에서 검색…"
            className="min-w-0 flex-1 rounded border border-(--era-input-border) bg-white px-3 py-2"
          />
          <button type="submit" className="rounded bg-forg-gold px-3 font-bold">
            검색
          </button>
        </form>
        <p className="mt-4 flex gap-4">
          <Link href="/" className="text-(--era-link) hover:underline">
            첫 화면
          </Link>
          <Link href="/site/" className="text-(--era-link) hover:underline">
            안내 페이지 목록
          </Link>
        </p>
      </div>
    </div>
  );
}
