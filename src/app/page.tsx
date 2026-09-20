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
import { Home2003Content } from "@/components/home-2003";
import { getBoard, type BoardId } from "@/lib/boards";
import { chromeUrl, type ChromeEra } from "@/lib/chrome";
import { getBoardIndex } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

/** This surface is the 2014 exhibit, so its assets are asked for at their
 *  2014 capture — see `lib/chrome` on why a filename alone is ambiguous. */
const ERA: ChromeEra = "2014";

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

interface BoxData {
  config: BoxConfig;
  totalPosts: number | null;
  entries: BoardIndexEntry[];
}

async function loadBox(config: BoxConfig): Promise<BoxData> {
  const index = await getBoardIndex(config.id, 1);
  if (!index) {
    return { config, totalPosts: null, entries: [] };
  }
  return {
    config,
    totalPosts: index.totalPosts,
    entries: index.entries.slice(0, BOX_RECENT_COUNT),
  };
}

export default async function HomePage() {
  const boxes = await Promise.all(MAIN_BOXES.map(loadBox));

  // Both era variants render server-side; the runtime `<html data-era>`
  // attribute hides one via CSS in globals.css (`.era-2014-only` /
  // `.era-2003-only`). This keeps the era toggle instantaneous (CSS-only,
  // no React re-render) and lets the static export ship both layouts.
  return <EraShell content2014={<BoxGrid boxes={boxes} />} content2003={<Home2003Content />} />;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  8-box main grid                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function BoxGrid({ boxes }: { boxes: BoxData[] }) {
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

function BoxCard({ box }: { box: BoxData }) {
  const headerUrl = chromeUrl(box.config.asset, ERA);
  const meta = getBoard(box.config.id);

  return (
    <section className="border-forg-gold/30 flex flex-col border-b" aria-label={box.config.label}>
      <Link
        href={`/${box.config.id}`}
        className="bg-forg-gold/10 hover:bg-forg-gold/20 group block h-[25px] w-full overflow-hidden"
        style={
          headerUrl
            ? {
                backgroundImage: `url(${headerUrl})`,
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
      >
        {!headerUrl && (
          <div className="flex h-full items-center justify-between px-2">
            <span className="text-forg-ink text-xs font-bold tracking-tight">
              {box.config.label}
            </span>
            <span className="text-forg-muted font-mono text-[9px] uppercase">
              {meta?.engine ?? "—"}
            </span>
          </div>
        )}
        {headerUrl && <span className="sr-only">{box.config.label}</span>}
      </Link>
      <div className="space-y-[2px] pt-[5px] pr-[1px] pb-[10px] pl-[10px]">
        {box.totalPosts === null ? (
          <p className="text-forg-muted py-2 text-[11px] italic">
            준비 중 — Phase B 다운로드 + Gnuboard4 파서 후 활성화
          </p>
        ) : box.entries.length === 0 ? (
          <p className="text-forg-muted py-2 text-[11px] italic">아직 게시글이 없습니다.</p>
        ) : (
          box.entries.map((entry) => (
            <BoxRow key={entry.postId} board={box.config.id} entry={entry} />
          ))
        )}
        {box.totalPosts !== null && box.totalPosts > BOX_RECENT_COUNT && (
          <Link
            href={`/${box.config.id}`}
            className="text-forg-muted hover:text-forg-gold-hover mt-1 inline-block text-[10px]"
          >
            전체 {box.totalPosts.toLocaleString("ko-KR")}건 →
          </Link>
        )}
      </div>
    </section>
  );
}

function BoxRow({ board, entry }: { board: BoardId; entry: BoardIndexEntry }) {
  // `line-clamp-1` compiles to `display:-webkit-box`, which is block-level
  // and pushed the count onto its own line. The original kept title, count
  // and state icons on one baseline.
  const fileIcon = entry.attachmentCount > 0 ? chromeUrl("skin_icon_file.gif", ERA) : null;
  const hotIcon =
    entry.commentCount >= HOT_COMMENT_THRESHOLD ? chromeUrl("skin_icon_hot.gif", ERA) : null;

  return (
    <Link
      href={`/${board}/${entry.postId}`}
      className="text-forg-muted flex items-center gap-[3px] text-[12px] leading-tight hover:underline"
    >
      <span className="truncate">{entry.title}</span>
      {entry.commentCount > 0 && (
        <span className="shrink-0 text-[10.5px] text-(--era-meta-fg) tabular-nums">
          ({entry.commentCount})
        </span>
      )}
      {fileIcon && <StateIcon url={fileIcon} width={9} height={9} label="첨부 있음" />}
      {hotIcon && <StateIcon url={hotIcon} width={11} height={9} label="댓글 많음" />}
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
    // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 9–11 px chrome
    <img src={url} alt={label} width={width} height={height} className="block shrink-0" />
  );
}
