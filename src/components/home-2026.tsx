/**
 * The 2026 front page (ADR-0023): the museum's own, not a capture. The
 * museum in four numbers and the way to the old boards; the three old
 * eras' front pages as buttons that switch to them; and the old boards by
 * category, the four with the most posts in each. Its looks are in
 * `src/styles/era-2026.css`.
 *
 * The era cards' pictures are the museum's own shots of the three front
 * pages (`public/img/chrome/2026/`). Unlike the era chrome (`ChromeImg`)
 * they are lazy: while 2026 is hidden they are not drawn, so a visit in
 * another era does not fetch them.
 */

import Link from "@/components/link";

import { ChromeImg } from "@/components/chrome-img";
import { boardSummaries, museumTotals } from "@/lib/board-catalog";
import { BOARD_CATEGORY_LABELS, getBoard, listBoards, type BoardCategory } from "@/lib/boards";
import { chromeUrl } from "@/lib/chrome";
import { DEFAULT_ERA, type Era } from "@/lib/era";

const count = (n: number) => n.toLocaleString("ko-KR");

/** The old eras, as the cards name them. */
const ERA_CARDS: { era: Era; note: string }[] = [
  { era: "2014", note: "Gnuboard4, 금색 머리" },
  { era: "2003", note: "Zeroboard, 왼쪽 메뉴" },
  { era: "2001", note: "Ultima Online of Forg" },
];

const BOARDS_PER_CATEGORY = 4;

export async function Home2026Content() {
  const [totals, summaries] = await Promise.all([museumTotals(), boardSummaries()]);
  const categories = (Object.keys(BOARD_CATEGORY_LABELS) as BoardCategory[]).map((category) => ({
    category,
    boards: listBoards()
      .filter((b) => b.category === category)
      .flatMap((b) => summaries.get(b.id) ?? [])
      .sort((a, b) => b.posts - a.posts)
      .slice(0, BOARDS_PER_CATEGORY),
  }));

  return (
    <>
      <section className="w26-hero">
        <div className="w26-id">
          <ChromeImg
            src={chromeUrl("left_logo1.gif", "2014")}
            alt="Forg's world 로고 (2014)"
            width={200}
            height={84}
            className="w26-logo"
          />
          <h1>
            forg <span>1998–2026</span>
          </h1>
          <p>
            울티마 온라인 커뮤니티 forg.co.kr의 디지털 박물관입니다. 1998년부터 2016년까지의 글이
            기록으로 남아 있습니다.
          </p>
          <p className="w26-stats">
            박물관 글 <b>{count(totals.posts)}</b> · 댓글 <b>{count(totals.comments)}</b> · 옛
            게시판 <b>{count(totals.boards)}</b> · 안내 문서 <b>{count(totals.guidePages)}</b>쪽
          </p>
          <Link href="/boards/" className="w26-btn">
            옛 게시판 보기
          </Link>
        </div>
        <div className="w26-eras">
          <h2>그 시절 모습으로</h2>
          <div className="w26-era-row">
            {ERA_CARDS.map(({ era, note }) => (
              <button
                key={era}
                type="button"
                aria-pressed={era === DEFAULT_ERA}
                data-era-option={era}
                suppressHydrationWarning
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- lazy on purpose, see above */}
                <img
                  src={chromeUrl(`era-${era}.jpg`, "2026")}
                  alt=""
                  width={400}
                  height={280}
                  loading="lazy"
                />
                <b>{era}</b>
                <small>{note}</small>
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="w26-body">
        <section className="w26-card">
          <h2>
            옛 게시판 <span className="w26-tag">기록</span>
          </h2>
          <div className="w26-cats">
            {categories.map(({ category, boards }) => (
              <div key={category}>
                <h3>{BOARD_CATEGORY_LABELS[category]}</h3>
                <ul>
                  {boards.map((s) => (
                    <li key={s.board}>
                      <Link href={`/${s.board}`}>{getBoard(s.board).nameKr}</Link>
                      <small>글 {count(s.posts)}</small>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="w26-more">
            <Link href="/boards/">모든 게시판 보기</Link>
          </p>
        </section>
      </div>
    </>
  );
}
