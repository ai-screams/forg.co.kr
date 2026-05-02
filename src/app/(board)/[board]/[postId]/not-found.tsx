import Link from "next/link";

import { EraToggle } from "@/components/era-toggle";

export default function PostNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-(--era-page-bg)">
      <header className="border-b border-(--era-input-border) bg-(--era-content-bg)">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-forg-ink font-forg text-lg font-bold">
            forg.co.kr
          </Link>
          <EraToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <div className="text-forg-ink rounded-md border border-(--era-input-border) bg-(--era-content-bg) p-8 text-center shadow-sm">
          <p className="text-forg-muted text-xs">404</p>
          <h1 className="text-forg-ink mt-2 text-2xl font-bold">게시글을 찾을 수 없습니다</h1>
          <p className="text-forg-muted mt-3 text-sm">
            요청하신 게시판이나 게시글 번호가 박물관 아카이브에 없습니다.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block text-(--era-link) underline hover:text-(--era-link-hover)"
          >
            처음으로
          </Link>
        </div>
      </main>

      <footer className="text-forg-cream border-t border-(--era-input-border) bg-(--era-footer-bg)">
        <div className="mx-auto max-w-3xl px-6 py-4 text-xs">
          <p>forg.co.kr 디지털 박물관</p>
        </div>
      </footer>
    </div>
  );
}
