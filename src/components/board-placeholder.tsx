/**
 * The page of a documented board Wayback kept nothing readable of: no post
 * and no list page (ADR-0013 keeps its URL anyway).
 *
 * Era-invariant markup; visual delta comes from `--era-*` CSS vars.
 */

import Link from "@/components/link";

import { ENGINE_LABELS, type BoardMeta } from "@/lib/boards";

interface BoardPlaceholderProps {
  meta: BoardMeta;
}

export function BoardPlaceholder({ meta }: BoardPlaceholderProps) {
  return (
    <article className="border border-(--era-input-border)/50 bg-white text-forg-ink">
      <header className="border-b border-(--era-input-border) px-6 py-5">
        <p className="font-mono text-[10px] tracking-wider text-forg-muted uppercase">
          {meta.id} · {meta.engine} · {meta.era}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-forg-ink">{meta.nameKr}</h1>
        {meta.description && <p className="mt-2 text-sm text-forg-muted">{meta.description}</p>}
      </header>

      <div className="px-6 py-10">
        <div className="mx-auto max-w-xl border border-dashed border-forg-gold/40 bg-forg-gold/5 p-6 text-center">
          <p className="font-mono text-xs tracking-wider text-forg-muted uppercase">
            {meta.memberOnly ? "회원 전용" : "읽을 수 있는 기록 없음"}
          </p>
          <h2 className="mt-2 text-lg font-bold text-forg-ink">
            {meta.memberOnly
              ? "회원만 볼 수 있던 게시판이라 남은 글이 없습니다"
              : "Wayback Machine에 읽을 수 있는 글이나 목록이 남지 않았습니다"}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-forg-muted">
            {meta.memberOnly
              ? "손님에게는 “사용권한이 없습니다”만 보였고, Wayback Machine도 손님으로 저장해서 그 안내만 남았습니다. 주소가 있었다는 기록으로 남깁니다."
              : "박물관은 Wayback Machine의 캡처로 게시판을 되살립니다. 이 게시판은 주소와 이름은 알려져 있지만, 재생되는 글이나 목록 페이지가 하나도 없습니다."}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-forg-muted">
            <dt className="text-right font-bold">엔진</dt>
            <dd className="text-left">{ENGINE_LABELS[meta.engine]}</dd>
            {/* A members-only board's era is a skin hint, not a fact anyone has
                (MoNgBaT is a 2007 capture); its description gives the dates. */}
            {!meta.memberOnly && (
              <>
                <dt className="text-right font-bold">활동 시기</dt>
                <dd className="text-left">{meta.era}</dd>
              </>
            )}
            <dt className="text-right font-bold">분류</dt>
            <dd className="text-left">{meta.category}</dd>
          </dl>
        </div>

        <p className="mt-6 text-center text-xs text-forg-muted">
          <Link
            href="/"
            className="text-(--era-link) underline underline-offset-2 hover:text-(--era-link-hover)"
          >
            처음으로
          </Link>
        </p>
      </div>
    </article>
  );
}
