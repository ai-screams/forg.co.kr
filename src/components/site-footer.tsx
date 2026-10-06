/**
 * Bottom-of-page chrome shared by every route.
 *
 * Era-invariant markup. The dark slate footer color is the same in every
 * era (`--era-footer-bg`), so the only thing that changes is the border
 * above it (driven by `--era-input-border`). Its last line leads to
 * the copyright and takedown page (`/policy/`).
 */

import Link from "@/components/link";

export function SiteFooter() {
  return (
    <footer
      role="contentinfo"
      className="border-t border-(--era-input-border) bg-(--era-footer-bg) text-forg-cream"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-1 px-6 py-5 text-xs">
        <p className="font-bold text-forg-cream">forg.co.kr 디지털 박물관 · 비영리 보존 프로젝트</p>
        <p className="text-forg-cream/80">
          원본 글의 저작권은 각 작성자에게 있습니다 ·{" "}
          <Link href="/policy/" className="underline underline-offset-2 hover:text-forg-gold">
            저작권과 삭제 요청
          </Link>
        </p>
      </div>
    </footer>
  );
}
