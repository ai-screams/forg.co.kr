/**
 * The page of a documented board Wayback kept nothing readable of: no post
 * and no list page (ADR-0013 keeps its URL anyway).
 *
 * Era-invariant markup; visual delta comes from `--era-*` CSS vars.
 */

import Link from "@/components/link";

import { type BoardMeta } from "@/lib/boards";

interface BoardPlaceholderProps {
  meta: BoardMeta;
}

const ENGINE_LABEL: Record<BoardMeta["engine"], string> = {
  zeroboard: "Zeroboard 4.1pl4",
  gnuboard4: "Gnuboard4",
  gnuboard5: "Gnuboard5",
};

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
            읽을 수 있는 기록 없음
          </p>
          <h2 className="mt-2 text-lg font-bold text-forg-ink">
            Wayback Machine에 읽을 수 있는 글이나 목록이 남지 않았습니다
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-forg-muted">
            박물관은 Wayback Machine의 캡처로 게시판을 되살립니다. 이 게시판은 주소와 이름은 알려져
            있지만, 재생되는 글이나 목록 페이지가 하나도 없습니다.
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-forg-muted">
            <dt className="text-right font-bold">엔진</dt>
            <dd className="text-left">{ENGINE_LABEL[meta.engine]}</dd>
            <dt className="text-right font-bold">활동 시기</dt>
            <dd className="text-left">{meta.era}</dd>
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
