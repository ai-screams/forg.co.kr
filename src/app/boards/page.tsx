/**
 * `/boards/` — every board forg had, by category (ADR-0023 §3): its name,
 * engine, the years its own dated rows span and what is left of it, the
 * members-only boards included. The 2026 menu's "옛 게시판" leads here; in
 * every era it is drawn in the era frame's content column, as the `/site/`
 * index is.
 */

import type { Metadata } from "next";

import Link from "@/components/link";

import { EraShell } from "@/components/era-shell";
import { boardSummaries, type BoardSummary } from "@/lib/board-catalog";
import { BOARD_CATEGORY_LABELS, ENGINE_LABELS, listBoards, type BoardCategory } from "@/lib/boards";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "옛 게시판 — forg.co.kr",
  description: "forg.co.kr에 있던 게시판 모두 — 분류, 엔진, 활동 시기, 남은 글 수",
  path: "/boards/",
});

const count = (n: number) => n.toLocaleString("ko-KR");

/** "2000–2007", "2019" for one year, "—" without a dated row. */
function years(summary: BoardSummary | undefined): string {
  if (!summary?.years) return "—";
  const [first, last] = summary.years;
  return first === last ? String(first) : `${first}–${last}`;
}

export default async function BoardsPage() {
  const summaries = await boardSummaries();
  const boards = listBoards();
  const posts = [...summaries.values()].reduce((n, s) => n + s.posts, 0);

  return (
    <EraShell>
      <article className="px-3 py-4 text-forg-ink">
        <header className="pb-3">
          <h1 className="forg-page-title text-[14px] font-bold">옛 게시판</h1>
          <p className="mt-[2px] text-[11px] text-forg-muted">
            forg.co.kr에 있던 게시판 {boards.length}곳입니다. 목록이 남은 곳은 {summaries.size}
            곳, 본문까지 남은 글은 {count(posts)}개입니다. 줄마다 엔진, 날짜가 남은 글의 연도,
            본문이 남은 글과 목록에 남은 제목의 수입니다.
          </p>
        </header>
        {(Object.keys(BOARD_CATEGORY_LABELS) as BoardCategory[]).map((category) => {
          const inCategory = boards.filter((b) => b.category === category);
          return (
            <section key={category} id={`category-${category}`} className="mb-4">
              <h2 className="border-b border-(--era-input-border) pb-[2px] text-[12px] font-bold">
                {BOARD_CATEGORY_LABELS[category]}{" "}
                <span className="font-normal text-forg-muted">{inCategory.length}곳</span>
              </h2>
              <ul className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
                {inCategory.map((b) => {
                  const summary = summaries.get(b.id);
                  return (
                    <li key={b.id} className="min-w-0">
                      <Link href={`/${b.id}`} className="font-bold hover:underline">
                        {b.nameKr}
                      </Link>
                      <span className="block truncate text-[11px] text-forg-muted">
                        {ENGINE_LABELS[b.engine]} ·{" "}
                        {b.memberOnly
                          ? "회원 전용"
                          : summary
                            ? `${years(summary)} · 글 ${count(summary.posts)} · 제목 ${count(summary.rows)}`
                            : "남은 글 없음"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </article>
    </EraShell>
  );
}
