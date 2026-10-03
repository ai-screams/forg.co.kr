/**
 * Museum landing — the exhibit inside the era frame.
 *
 * The frame itself (rails, sidebar, header, counter strip) lives in
 * `<EraShell>` so that board and post routes wear the same one. This file
 * only builds what sits in the 680px column: the 2014 eight-box grid of
 * latest posts, reproduced from the 2014-12-18 capture, and — for the
 * 2003 era — the Zeroboard front page's own main frame.
 *
 * Boards linked here are mostly Gnuboard4 (P2.2 deferred) and Phase B
 * downloads (P3.3 pending). Their /[board] URLs render `<BoardPlaceholder>`
 * until parsers + downloads land.
 *
 * Chrome assets (box headers, state icons) come from Wayback via
 * `scripts/etl/recover-chrome.py`. When an asset is missing the page falls
 * back to typography / OKLCH CSS — see `chromeUrl` in `lib/chrome`.
 */

import Link from "@/components/link";

import { EraShell } from "@/components/era-shell";
import { Home2001Content } from "@/components/home-2001";
import { Home2003Content } from "@/components/home-2003";
import { LazyImg } from "@/components/lazy-img";
import { getBoard, type BoardId } from "@/lib/boards";
import { chromeUrl, tileStyle } from "@/lib/chrome";
import type { Era } from "@/lib/era";
import { getPost, getRecentPostEntries } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

/** This surface is the 2014 exhibit, so its assets are asked for at their
 *  2014 capture — see `lib/chrome` on why a filename alone is ambiguous. */
const ERA: Era = "2014";

interface BoxConfig {
  id: BoardId;
  label: string;
  asset: string;
}

/** Snapshot order in `2014-12-18.html`: 4 rows × 2 cols → 8 boxes. */
const MAIN_BOXES: BoxConfig[] = [
  { id: "UoBoard2", label: "자유게시판", asset: "main_list_1.gif" },
  { id: "FunBoard", label: "펀보드", asset: "main_list_2.gif" },
  { id: "Reveal", label: "스포일러게시판", asset: "main_list_3.gif" },
  { id: "porato", label: "포토갤러리", asset: "main_list_4.gif" },
  { id: "Trash", label: "휴지통게시판", asset: "main_list_5.gif" },
  { id: "Ultima", label: "울티마온라인", asset: "main_list_6.gif" },
  { id: "Console", label: "콘솔게임", asset: "main_list_7.gif" },
  { id: "Shop", label: "상점 (거래)", asset: "main_list_8.gif" },
];

/** Comment count at which a row gets the original's `icon_hot` marker.
 *  Zeroboard keyed "hot" off hit counts, which survive for ~1% of posts. */
const HOT_COMMENT_THRESHOLD = 10;

const BOX_RECENT_COUNT = 8;

/** An index row plus the one fact the row icons need from the post itself. */
interface BoxEntry {
  entry: BoardIndexEntry;
  hasLink: boolean;
}

interface BoxData {
  config: BoxConfig;
  totalPosts: number | null;
  entries: BoxEntry[];
}

/**
 * `<a href="http…">` pointing somewhere other than forg itself. Gnuboard set
 * `icon_link` from the post's own `wr_link` fields, which the captures do not
 * preserve; a body link is the closest fact the gold tier holds.
 *
 * The lookahead ends the host on a non-host character, so `forg.co.kr.evil…`
 * counts as external while `http://forg.co.kr을` — a bare URL an author wrote
 * with a Korean particle glued on, which the corpus does contain — does not.
 * The sanitiser (`scripts/etl/sanitise.py`) leaves every href lowercase and
 * double-quoted, so no other quoting shape needs covering.
 */
const EXTERNAL_LINK = /<a\s[^>]*href="https?:\/\/(?!(?:www\.)?forg\.co\.kr(?![a-z0-9.-]))[^"]+"/i;

async function loadBox(config: BoxConfig): Promise<BoxData> {
  // The box teases posts a visitor can open; title-only rows (ADR-0017 §4)
  // stay in the board listing.
  const recent = await getRecentPostEntries(config.id, BOX_RECENT_COUNT);
  if (!recent) {
    return { config, totalPosts: null, entries: [] };
  }

  const entries = await Promise.all(
    recent.entries.map(async (entry) => {
      const post = await getPost(config.id, entry.postId);
      return { entry, hasLink: post ? EXTERNAL_LINK.test(post.bodyHtml) : false };
    }),
  );

  return { config, totalPosts: recent.totalPosts, entries };
}

export default function HomePage() {
  // Both era variants render server-side; the runtime `<html data-era>`
  // attribute hides one via CSS in globals.css (`.era-2014-only` /
  // `.era-2003-only`). This keeps the era toggle instantaneous (CSS-only,
  // no React re-render) and lets the static export ship both layouts.
  return (
    <EraShell
      content2014={<BoxGrid />}
      content2003={<Home2003Content />}
      content2001={<Home2001Content />}
    />
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/*  8-box main grid                                                       */
/* ──────────────────────────────────────────────────────────────────── */

/** Loads its own boxes, so the 2003 and 2001 contents render alongside. */
async function BoxGrid() {
  const boxes = await Promise.all(MAIN_BOXES.map(loadBox));
  return (
    <div className="grow bg-(--era-content-bg) pt-[15px] pb-4">
      <div className="mx-auto grid w-full max-w-[640px] grid-cols-1 gap-0 sm:grid-cols-[320px_320px]">
        {boxes.map((box) => (
          <BoxCard key={box.config.id} box={box} />
        ))}
      </div>
    </div>
  );
}

/**
 * The 320×25 box header art is a grey tab whose rows are flat from x=240 to the
 * `›` that starts at x=313. Wider than 320px (one column on a phone) the tab is
 * drawn in three parts — the art up to x=300, those rows as a CSS gradient,
 * the art's last 7px — so it spans the box instead of stopping short. Column
 * 250 of every main_list_*.gif, top to bottom:
 */
const TAB_ROWS = [
  "#e5e5e4", "#ffffff", "#ffffff", "#ffffff", "#fdfdfd", "#fdfdfd", "#fdfbfc", "#fdfbfd",
  "#fcfcfb", "#fafafa", "#fafafa", "#f3f3f3", "#f3f3f3", "#f3f3f3", "#f4f4f4", "#f4f4f5",
  "#f3f3f3", "#f4f4f4", "#f3f3f3", "#f5f5f5", "#f7f7f7", "#fefefe", "#c1c1c1", "#e8e8e8",
  "#f7f7f7",
] as const; // prettier-ignore
const TAB_FILL = `linear-gradient(to bottom, ${TAB_ROWS.map((c, i) => `${c} ${String(i)}px ${String(i + 1)}px`).join(", ")})`;

function BoxCard({ box }: { box: BoxData }) {
  const headerUrl = chromeUrl(box.config.asset, ERA);
  const meta = getBoard(box.config.id);

  return (
    <section
      className="border-forg-gold/30 flex flex-col border-b max-sm:mb-3 max-sm:border max-sm:border-[#e3e3e3]"
      aria-label={box.config.label}
    >
      {headerUrl && (
        <Link
          href={`/${box.config.id}`}
          aria-hidden
          tabIndex={-1}
          className="relative block h-[25px] w-full sm:hidden"
          style={{ backgroundImage: TAB_FILL }}
        >
          <span
            className="absolute inset-y-0 left-0 w-[300px] max-w-[calc(100%-7px)]"
            style={tileStyle(headerUrl, "no-repeat")}
          />
          <span
            className="absolute inset-y-0 right-0 w-[7px]"
            style={tileStyle(headerUrl, "no-repeat", "right top")}
          />
        </Link>
      )}
      <Link
        href={`/${box.config.id}`}
        className={[
          "bg-forg-gold/10 hover:bg-forg-gold/20 group block h-[25px] w-full overflow-hidden",
          // Phones get the full-width tab above instead.
          headerUrl ? "max-sm:hidden" : "",
        ].join(" ")}
        style={tileStyle(headerUrl, "no-repeat")}
      >
        {!headerUrl && (
          <div className="flex h-full items-center justify-between px-2">
            <span className="text-forg-ink text-xs font-bold tracking-tight">
              {box.config.label}
            </span>
            <span className="text-forg-muted font-mono text-[9px] uppercase">{meta.engine}</span>
          </div>
        )}
        {headerUrl && <span className="sr-only">{box.config.label}</span>}
      </Link>
      <div className="space-y-[2px] pt-[5px] pr-[1px] pb-[10px] pl-[10px] max-sm:space-y-0 max-sm:px-3 max-sm:pt-1">
        {box.totalPosts === null ? (
          <p className="text-forg-muted py-2 text-[11px] italic">
            준비 중 — Phase B 다운로드 + Gnuboard4 파서 후 활성화
          </p>
        ) : box.entries.length === 0 ? (
          <p className="text-forg-muted py-2 text-[11px] italic">아직 게시글이 없습니다.</p>
        ) : (
          box.entries.map((row) => (
            <BoxRow
              key={row.entry.postId}
              board={box.config.id}
              entry={row.entry}
              hasLink={row.hasLink}
            />
          ))
        )}
        {box.totalPosts !== null && box.totalPosts > BOX_RECENT_COUNT && (
          <Link
            href={`/${box.config.id}`}
            className="text-forg-muted hover:text-forg-gold-hover mt-1 inline-block text-[10px] max-sm:mt-2 max-sm:block max-sm:text-right max-sm:text-[12px]"
          >
            전체 {box.totalPosts.toLocaleString("ko-KR")}건 →
          </Link>
        )}
      </div>
    </section>
  );
}

function BoxRow({
  board,
  entry,
  hasLink,
}: {
  board: BoardId;
  entry: BoardIndexEntry;
  hasLink: boolean;
}) {
  // `line-clamp-1` compiles to `display:-webkit-box`, which is block-level
  // and pushed the count onto its own line. The original kept title, count
  // and state icons on one baseline.
  const fileIcon = entry.attachmentCount > 0 ? chromeUrl("skin_icon_file.gif", ERA) : null;
  const linkIcon = hasLink ? chromeUrl("skin_icon_link.gif", ERA) : null;
  const hotIcon =
    entry.commentCount >= HOT_COMMENT_THRESHOLD ? chromeUrl("skin_icon_hot.gif", ERA) : null;

  return (
    <Link
      href={`/${board}/${entry.postId}`}
      className="text-forg-muted max-sm:text-forg-ink flex items-center gap-[3px] text-[12px] leading-tight hover:underline max-sm:border-b max-sm:border-dotted max-sm:border-[#e3e3e3] max-sm:py-[7px] max-sm:text-[14px]"
    >
      <span className="truncate">{entry.title}</span>
      {entry.commentCount > 0 && (
        <span className="shrink-0 text-[10.5px] text-(--era-meta-fg) tabular-nums">
          ({entry.commentCount})
        </span>
      )}
      {/* The 2014 skin drew these in this order: file, link, hot. */}
      {fileIcon && <StateIcon url={fileIcon} width={9} height={9} label="첨부 있음" />}
      {linkIcon && <StateIcon url={linkIcon} width={13} height={13} label="링크 있음" />}
      {hotIcon && <StateIcon url={hotIcon} width={11} height={9} label="댓글 많음" />}
      {/* Phone only: the date the 320px box had no room for. */}
      {entry.createdAt >= "1990" && (
        <span className="ml-auto shrink-0 pl-2 text-[11px] text-(--era-meta-fg) tabular-nums sm:hidden">
          {entry.createdAt.slice(2, 4)}.{entry.createdAt.slice(5, 7)}.{entry.createdAt.slice(8, 10)}
        </span>
      )}
    </Link>
  );
}

function StateIcon({
  url,
  width,
  height,
  label,
}: {
  url: string;
  width: number;
  height: number;
  label: string;
}) {
  return <LazyImg src={url} alt={label} width={width} height={height} className="block shrink-0" />;
}
