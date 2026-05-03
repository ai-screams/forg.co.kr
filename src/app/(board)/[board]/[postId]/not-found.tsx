import Link from "next/link";

export default function PostNotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 py-16">
      <div className="text-forg-ink w-full rounded-md border border-(--era-input-border) bg-(--era-content-bg) p-8 text-center shadow-sm">
        <p className="text-forg-muted font-mono text-xs tracking-wider uppercase">404</p>
        <h1 className="text-forg-ink mt-2 text-2xl font-bold tracking-tight">
          게시글을 찾을 수 없습니다
        </h1>
        <p className="text-forg-muted mt-3 text-sm">
          요청하신 게시판이나 게시글 번호가 박물관 아카이브에 없습니다.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-(--era-link) underline underline-offset-2 hover:text-(--era-link-hover)"
        >
          처음으로
        </Link>
      </div>
    </div>
  );
}
