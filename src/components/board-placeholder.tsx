/**
 * Placeholder rendered for documented boards whose posts haven't been
 * parsed yet. The 2014 main page links to every board listed in
 * `src/lib/boards.ts`; if a visitor lands on one before its parser runs
 * (Gnuboard4 → P2.2, Phase B downloads → P3.3), they see this card
 * instead of a 404.
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

const READY_REASON: Record<BoardMeta["engine"], string> = {
  zeroboard:
    "Zeroboard 보드 파서는 가동 중이지만, 이 게시판은 Phase A 다운로드 또는 ETL 일괄 실행 대상에 아직 포함되지 않았습니다. 후속 ETL 통과 시 자동으로 활성화됩니다.",
  gnuboard4:
    "Gnuboard4 엔진 파서는 ROADMAP P2.2 에서 구현 예정입니다. Phase B 다운로드 (P3.3) 도 함께 진행되면 게시글이 자동으로 채워집니다.",
  gnuboard5: "forg.kr 후속 사이트의 Gnuboard5 데이터는 P2.3 (선택 단계) 에서 검토합니다.",
};

export function BoardPlaceholder({ meta }: BoardPlaceholderProps) {
  return (
    <article className="text-forg-ink border border-(--era-input-border)/50 bg-white">
      <header className="border-b border-(--era-input-border) px-6 py-5">
        <p className="text-forg-muted font-mono text-[10px] tracking-wider uppercase">
          {meta.id} · {meta.engine} · {meta.era}
        </p>
        <h1 className="text-forg-ink mt-1 text-2xl font-bold tracking-tight">{meta.nameKr}</h1>
        {meta.description && <p className="text-forg-muted mt-2 text-sm">{meta.description}</p>}
      </header>

      <div className="px-6 py-10">
        <div className="border-forg-gold/40 bg-forg-gold/5 mx-auto max-w-xl border border-dashed p-6 text-center">
          <p className="text-forg-muted font-mono text-xs tracking-wider uppercase">준비 중</p>
          <h2 className="text-forg-ink mt-2 text-lg font-bold">
            이 게시판은 아직 박물관에 들어오지 않았습니다
          </h2>
          <p className="text-forg-muted mt-3 text-sm leading-relaxed">
            {READY_REASON[meta.engine]}
          </p>
          <dl className="text-forg-muted mt-5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-right font-bold">엔진</dt>
            <dd className="text-left">{ENGINE_LABEL[meta.engine]}</dd>
            <dt className="text-right font-bold">활동 시기</dt>
            <dd className="text-left">{meta.era}</dd>
            <dt className="text-right font-bold">분류</dt>
            <dd className="text-left">{meta.category}</dd>
          </dl>
        </div>

        <p className="text-forg-muted mt-6 text-center text-xs">
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
