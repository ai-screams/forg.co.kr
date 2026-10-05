/**
 * Museum landing — 2014 era home: the eight-box grid of latest posts from
 * the 2014-12-18 capture (`2014-12-18.html`), what sits in the 680px column.
 * The frame around it is `era-chrome-2014.tsx`.
 *
 * Chrome assets (box headers, state icons) come from Wayback via
 * `scripts/etl/recover-chrome.py` (`chromeUrl` in `lib/chrome`).
 */

import Link from "@/components/link";

import { ChromeImg } from "@/components/chrome-img";
import { getBoard, type BoardId } from "@/lib/boards";
import { chromeUrl, tileStyle } from "@/lib/chrome";
import { formatShortDate, isUnknownDate } from "@/lib/dates";
import type { Era } from "@/lib/era";
import { getPost, getRecentPostEntries } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

/** This surface is the 2014 exhibit, so its assets are asked for at their
 *  2014 capture — see `lib/chrome` on why a filename alone is ambiguous. */
const ERA: Era = "2014";

/** A box: its board (whose Korean name labels it) and its header art. */
interface BoxConfig {
  id: BoardId;
  asset: string;
}

/** Snapshot order in `2014-12-18.html`: 4 rows × 2 cols → 8 boxes. */
const MAIN_BOXES: BoxConfig[] = [
  { id: "UoBoard2", asset: "main_list_1.gif" },
  { id: "FunBoard", asset: "main_list_2.gif" },
  { id: "Reveal", asset: "main_list_3.gif" },
  { id: "porato", asset: "main_list_4.gif" },
  { id: "Trash", asset: "main_list_5.gif" },
  { id: "Ultima", asset: "main_list_6.gif" },
  { id: "Console", asset: "main_list_7.gif" },
  { id: "Shop", asset: "main_list_8.gif" },
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
  totalPosts: number;
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

  const entries = await Promise.all(
    recent.entries.map(async (entry) => {
      const post = await getPost(config.id, entry.postId);
      return { entry, hasLink: post ? EXTERNAL_LINK.test(post.bodyHtml) : false };
    }),
  );

  return { config, totalPosts: recent.totalPosts, entries };
}

/* ──────────────────────────────────────────────────────────────────── */
/*  8-box main grid                                                       */
/* ──────────────────────────────────────────────────────────────────── */

/**
 * The 2014 exhibit itself — what goes in the 680px column. Loads its own
 * boxes, so the 2003 and 2001 contents render alongside.
 */
export async function Home2014Content() {
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
      className="flex flex-col border-b border-forg-gold/30 max-sm:mb-3 max-sm:border max-sm:border-phone-rule"
      aria-label={meta.nameKr}
    >
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
      {/* Phones get the full-width tab above instead. */}
      <Link
        href={`/${box.config.id}`}
        className="group block h-[25px] w-full overflow-hidden bg-forg-gold/10 hover:bg-forg-gold/20 max-sm:hidden"
        style={tileStyle(headerUrl, "no-repeat")}
      >
        <span className="sr-only">{meta.nameKr}</span>
      </Link>
      <div className="space-y-[2px] pt-[5px] pr-[1px] pb-[10px] pl-[10px] max-sm:space-y-0 max-sm:px-3 max-sm:pt-1">
        {box.entries.map((row) => (
          <BoxRow
            key={row.entry.postId}
            board={box.config.id}
            entry={row.entry}
            hasLink={row.hasLink}
          />
        ))}
        {box.totalPosts > BOX_RECENT_COUNT && (
          <Link
            href={`/${box.config.id}`}
            className="mt-1 inline-block text-[10px] text-forg-muted hover:text-forg-gold-hover max-sm:mt-2 max-sm:block max-sm:text-right max-sm:text-[12px]"
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
  return (
    <Link
      href={`/${board}/${entry.postId}`}
      className="flex items-center gap-[3px] text-[12px] leading-tight text-forg-muted hover:underline max-sm:border-b max-sm:border-dotted max-sm:border-phone-rule max-sm:py-[7px] max-sm:text-[14px] max-sm:text-forg-ink"
    >
      <span className="truncate">{entry.title}</span>
      {entry.commentCount > 0 && (
        <span className="shrink-0 text-[10.5px] text-(--era-meta-fg) tabular-nums">
          ({entry.commentCount})
        </span>
      )}
      {/* The 2014 skin drew these in this order: file, link, hot. */}
      {entry.attachmentCount > 0 && (
        <StateIcon
          url={chromeUrl("skin_icon_file.gif", ERA)}
          width={9}
          height={9}
          label="첨부 있음"
        />
      )}
      {hasLink && (
        <StateIcon
          url={chromeUrl("skin_icon_link.gif", ERA)}
          width={13}
          height={13}
          label="링크 있음"
        />
      )}
      {entry.commentCount >= HOT_COMMENT_THRESHOLD && (
        <StateIcon
          url={chromeUrl("skin_icon_hot.gif", ERA)}
          width={11}
          height={9}
          label="댓글 많음"
        />
      )}
      {/* Phone only: the date the 320px box had no room for. */}
      {!isUnknownDate(entry.createdAt) && (
        <span className="ml-auto shrink-0 pl-2 text-[11px] text-(--era-meta-fg) tabular-nums sm:hidden">
          {formatShortDate(entry.createdAt)}
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
  return (
    <ChromeImg src={url} alt={label} width={width} height={height} className="block shrink-0" />
  );
}
