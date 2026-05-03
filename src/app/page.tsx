/**
 * Museum landing — replaces the P0.5 token-swatch demo.
 *
 * Built as an async Server Component: post counts come from each board's
 * `index-1.json` (gold-tier paginated index, ADR-0008 / P1.2). Boards
 * with no content yet are filtered out, so adding a parser for a new
 * board automatically surfaces it here.
 *
 * Markup is era-invariant. KISS: hero band + responsive card grid; no
 * primitives carved out yet (YAGNI). Component-extract once a 2nd
 * consumer needs the same shape (e.g. P2.5 board listing card).
 */

import Link from "next/link";

import { listBoards, type BoardId } from "@/lib/boards";
import { getBoardIndex } from "@/lib/posts";
import type { PostEra } from "@/types/post";

interface ActiveBoard {
  id: BoardId;
  nameKr: string;
  description: string | undefined;
  totalPosts: number;
  era: PostEra;
}

async function loadActiveBoards(): Promise<ActiveBoard[]> {
  const candidates = listBoards();
  const cards = await Promise.all(
    candidates.map(async (board): Promise<ActiveBoard | null> => {
      const index = await getBoardIndex(board.id as BoardId, 1);
      if (!index || index.totalPosts === 0) return null;
      return {
        id: board.id as BoardId,
        nameKr: board.nameKr,
        description: board.description,
        totalPosts: index.totalPosts,
        era: board.era,
      };
    }),
  );
  return cards
    .filter((c): c is ActiveBoard => c !== null)
    .sort((a, b) => b.totalPosts - a.totalPosts);
}

export default async function HomePage() {
  const active = await loadActiveBoards();

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 sm:py-14">
      <HeroBlock activeCount={active.length} />
      <ActiveBoardsSection boards={active} />
    </div>
  );
}

function HeroBlock({ activeCount }: { activeCount: number }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="text-forg-ink rounded-md border border-(--era-input-border) bg-(--era-content-bg) px-6 py-8 shadow-sm sm:px-10 sm:py-10"
    >
      <p className="text-forg-muted font-mono text-xs tracking-wider uppercase">
        Korean Ultima Online · 1999—2015
      </p>
      <h1
        id="hero-heading"
        className="font-forg text-forg-ink mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
      >
        forg.co.kr 디지털 박물관
      </h1>
      <p className="text-forg-muted mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
        한국 울티마 온라인 최대 팬사이트 forg.co.kr를 Internet Archive Wayback 캡처로부터
        복원합니다. 시그니처 골드와 두 시기(2014 / 2003)의 시각 정체성을 살리고, 약 13,000여 건의
        게시글을 영구 보존합니다.
      </p>
      <div className="text-forg-muted mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <span className="bg-forg-gold text-forg-ink rounded-full px-3 py-1 font-bold">
          🚧 초기 구축 단계
        </span>
        <span>
          현재 <strong className="text-forg-ink">{activeCount}개 게시판</strong> 공개 — 추가
          게시판은 ETL 파이프라인이 처리되는 대로 자동 합류합니다.
        </span>
      </div>
    </section>
  );
}

function ActiveBoardsSection({ boards }: { boards: ActiveBoard[] }) {
  if (boards.length === 0) {
    return (
      <p className="text-forg-muted mt-10 text-sm">
        아직 공개된 게시판이 없습니다. ETL 파이프라인 진행 상황을 잠시 후 다시 확인해 주세요.
      </p>
    );
  }

  return (
    <section aria-labelledby="active-heading" className="mt-10">
      <header className="flex items-baseline justify-between gap-4">
        <h2 id="active-heading" className="text-forg-ink text-lg font-bold tracking-tight">
          공개된 게시판
        </h2>
        <p className="text-forg-muted text-xs">최신 글 → 클릭으로 이동</p>
      </header>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {boards.map((board) => (
          <BoardCard key={board.id} board={board} />
        ))}
      </ul>
    </section>
  );
}

function BoardCard({ board }: { board: ActiveBoard }) {
  return (
    <li>
      <Link
        href={`/${board.id}`}
        className="text-forg-ink hover:border-forg-gold focus-visible:border-forg-gold flex h-full flex-col rounded-md border border-(--era-input-border) bg-(--era-content-bg) px-5 py-4 shadow-sm transition-colors focus-visible:outline-none"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-forg-ink text-base leading-tight font-bold">{board.nameKr}</h3>
          <span className="text-forg-muted font-mono text-[10px] tracking-wide uppercase">
            {board.era}
          </span>
        </div>
        {board.description && (
          <p className="text-forg-muted mt-1 line-clamp-2 text-xs leading-snug">
            {board.description}
          </p>
        )}
        <p className="text-forg-muted mt-3 text-xs">
          <strong className="text-forg-ink">{board.totalPosts.toLocaleString("ko-KR")}</strong> 개
          게시글
        </p>
      </Link>
    </li>
  );
}
