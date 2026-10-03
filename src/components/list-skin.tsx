/**
 * The board-list table, drawn in the skin the board wore. `<BoardListing>`
 * (post-backed index) and `<BoardListingOnly>` (rows from captured list
 * pages) both render it and only differ in the rows they hand over.
 *
 * Which skin comes from the engine, per the 707 captured list pages:
 *
 * - `kritz` — Zeroboard. Five `kritz_*` skins; every header label recovered
 *   for more than one of them has the same bytes in each (md5 over
 *   `public/img/chrome/zb_kritz*_title_*`), so the `kritz_normal2` set
 *   (`zb_kritz_*`) stands for all five. Columns: status · 이름 · 제목 · 날짜.
 * - `webbus` — Gnuboard4, the 2014 `webbus2009_basic` skin (13 of the 14
 *   Gnuboard4 boards have a capture wearing it). Columns: 번호 · 제목 ·
 *   글쓴이 · 날짜.
 * - `plain` — Gnuboard5 (forg.kr, 2019); no list capture wears a skin the
 *   museum holds, so text headers.
 */

import type { ReactNode } from "react";

import { ListTable2001, type Row2001 } from "@/components/list-skin-2001";
import { chromeUrl } from "@/lib/chrome";
import type { Skin2001 } from "@/lib/skins-2001";
import type { SourceEngine } from "@/types/post";

export type ListSkin = "kritz" | "webbus" | "plain";

export function listSkinOf(engine: SourceEngine): ListSkin {
  if (engine === "zeroboard") return "kritz";
  if (engine === "gnuboard4") return "webbus";
  return "plain";
}

/**
 * Gnuboard4 `bo_hot`: a list row got `icon_hot.gif` once its hits reached
 * this. Recovered from the 13 captured `webbus2009_basic` lists — the rule
 * `hits >= 500`, with UoBoard2 at 100 (hot there from 125; 100 is Gnuboard4's
 * default), matches all 262 rows that print a hit count. 500 everywhere
 * matches 244, 100 everywhere 173, and "10 or more comments" 107.
 */
const WEBBUS_HOT_HITS_DEFAULT = 500;
const WEBBUS_HOT_HITS: Readonly<Record<string, number>> = { UoBoard2: 100 };

function isHot(board: string, hits: number | null): boolean {
  return hits !== null && hits >= (WEBBUS_HOT_HITS[board] ?? WEBBUS_HOT_HITS_DEFAULT);
}

interface HeadLabel {
  /** Recovered label image, drawn at its own size. */
  asset: string;
  width: number;
  height: number;
  /** Text header, and the image's alt. */
  label: string;
}

type ColumnKey = "status" | "num" | "name" | "title" | "date" | "hits";

interface Column {
  key: ColumnKey;
  /** `<col>` classes: width, and `hidden sm:table-column` for the name. */
  col: string;
  /** Extra `<th>` classes. */
  th?: string;
  head: HeadLabel;
  /** The status column had an icon, not a word, in the original too. */
  labelHidden?: boolean;
}

const NAME_HIDDEN = "hidden sm:table-cell";

// `kritz_normal2`: `<td width=20>` · `width=100` · flexible · `width=30` · `width=30`.
const KRITZ: Record<Exclude<ColumnKey, "num">, Column> = {
  status: {
    key: "status",
    col: "w-[20px]",
    head: { asset: "zb_kritz_title_icon.gif", width: 13, height: 9, label: "상태" },
    labelHidden: true,
  },
  name: {
    key: "name",
    col: "hidden w-[100px] sm:table-column",
    th: NAME_HIDDEN,
    head: { asset: "zb_kritz_title_name.gif", width: 33, height: 12, label: "이름" },
  },
  title: {
    key: "title",
    col: "",
    th: "text-left pl-1",
    head: { asset: "zb_kritz_title_title.gif", width: 56, height: 12, label: "제목" },
  },
  date: {
    key: "date",
    col: "w-[52px]",
    head: { asset: "zb_kritz_title_date.gif", width: 9, height: 12, label: "날짜" },
  },
  hits: {
    key: "hits",
    col: "w-[44px]",
    head: { asset: "zb_kritz_title_hit.gif", width: 11, height: 12, label: "조회" },
  },
};

// `webbus2009_basic`: `<td width=50>` · flexible · `width=90` · `width=65` · `width=60`.
const WEBBUS: Record<Exclude<ColumnKey, "status">, Column> = {
  num: {
    key: "num",
    col: "w-[50px]",
    head: { asset: "gb_w_1.gif", width: 26, height: 13, label: "번호" },
  },
  title: {
    key: "title",
    col: "",
    head: { asset: "gb_w_2.gif", width: 29, height: 13, label: "제목" },
  },
  name: {
    key: "name",
    col: "hidden w-[90px] sm:table-column",
    th: NAME_HIDDEN,
    head: { asset: "gb_w_3.gif", width: 33, height: 13, label: "글쓴이" },
  },
  date: {
    key: "date",
    col: "w-[65px]",
    head: { asset: "gb_w_4.gif", width: 24, height: 13, label: "날짜" },
  },
  hits: {
    key: "hits",
    col: "w-[60px]",
    head: { asset: "gb_w_5.gif", width: 31, height: 12, label: "조회" },
  },
};

function columnsFor(skin: ListSkin, withHits: boolean): Column[] {
  const cols =
    skin === "webbus"
      ? [WEBBUS.num, WEBBUS.title, WEBBUS.name, WEBBUS.date, WEBBUS.hits]
      : [KRITZ.status, KRITZ.name, KRITZ.title, KRITZ.date, KRITZ.hits];
  return withHits ? cols : cols.filter((c) => c.key !== "hits");
}

export interface ListRow {
  key: string;
  /** The title cell's content — a link, or plain text for a title-only row. */
  title: ReactNode;
  author: ReactNode;
  date: ReactNode;
  /** Only read when the table has a 조회 column. */
  hits?: ReactNode;
}

/**
 * After the title of a row known only from a captured list page: there is no
 * post behind it, and greyed text alone read as a broken link (the old `title`
 * tooltip never shows on a phone). The museum's own mark.
 */
export function NoBodyMark() {
  return (
    <span className="text-forg-muted shrink-0 rounded-[2px] border border-current/40 px-[3px] text-[10px] leading-[14px] whitespace-nowrap">
      본문 없음
    </span>
  );
}

/**
 * The whole table. `firstNumber` is what `webbus` prints in the 번호 column
 * for the first row, counting down: Gnuboard's list number is
 * `total_count - (page - 1) * page_rows - i`, a position rather than an id.
 */
export function ListTable({
  skin,
  rows,
  withHits,
  firstNumber,
  era2001,
}: {
  skin: ListSkin;
  rows: readonly ListRow[];
  withHits: boolean;
  firstNumber: number;
  /** The same rows for the 2001 era's skin (`list-skin-2001`), which draws them itself. */
  era2001: {
    skin: Skin2001;
    rows: readonly Row2001[];
    totalPosts: number;
    page: number;
    totalPages: number;
  };
}) {
  const columns = columnsFor(skin, withHits);

  return (
    <>
      <NarrowList rows={rows} />
      <div className="era-2001-only hidden sm:block">
        <ListTable2001 firstNumber={firstNumber} {...era2001} />
      </div>
      <div className="era-not-2001 hidden border border-(--era-input-border)/50 bg-white sm:block">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            {columns.map((c) => (
              <col key={c.key} className={c.col} />
            ))}
          </colgroup>
          <thead>
            <HeadRow skin={skin} columns={columns} />
            <HeadRule skin={skin} span={columns.length} />
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.key} className="border-b border-(--era-input-border)/25 last:border-0">
                {columns.map((c) => (
                  <Cell key={c.key} column={c.key} row={row} number={firstNumber - i} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Below `sm` (640px) the fixed-column table has no room: the title ran over
 * the date and the number column squeezed both. A phone gets one row per
 * post in two lines — the title, then name · date — and the skins' header
 * art is left to wider screens, where the table is exactly as before.
 */
function NarrowList({ rows }: { rows: readonly ListRow[] }) {
  return (
    <ul className="border border-(--era-input-border)/50 bg-white sm:hidden">
      {rows.map((row) => (
        <li
          key={row.key}
          className="border-b border-(--era-input-border)/25 px-2 py-[6px] text-[13px] last:border-0"
        >
          {/* The title link is inline-flex; capping it lets its truncate work. */}
          <div className="min-w-0 overflow-hidden [&>*]:max-w-full">{row.title}</div>
          <div className="text-forg-muted mt-[2px] flex gap-2 text-[11px] tabular-nums">
            <span className="truncate">{row.author}</span>
            <span className="shrink-0">{row.date}</span>
            {row.hits !== undefined && row.hits !== null && (
              <span className="shrink-0">조회 {row.hits}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Cell({ column, row, number }: { column: ColumnKey; row: ListRow; number: number }) {
  const meta = "text-forg-muted text-center align-middle text-[11px] tabular-nums";
  switch (column) {
    case "status":
      // Empty on purpose. The column's one visible icon, `new_head.gif`
      // ("따끈 따근한글"), marked a post written the day the page was served
      // — 58 of the 71 rows that carry it across 707 captured list pages —
      // and every other row got `old_head.gif`, a 1×13 blank. Seen from the
      // museum no post is that fresh.
      return (
        <td className="text-center align-middle">
          <RowSpacer height={3} />
        </td>
      );
    case "num":
      // `<span style='font:normal 9px tahoma; color:#B3B3B3;'>594</span>`
      return (
        <td className="text-webbus-num text-center align-middle font-[Tahoma,sans-serif] text-[9px] tabular-nums">
          {number}
        </td>
      );
    case "name":
      return (
        <td className="text-forg-muted hidden truncate px-1 text-center align-middle text-[11px] sm:table-cell">
          {row.author}
        </td>
      );
    case "title":
      return (
        <td className="px-1 align-middle break-all">
          {row.title}
          <p className="text-forg-muted text-[10.5px] sm:hidden">{row.author}</p>
        </td>
      );
    case "date":
      return <td className={meta}>{row.date}</td>;
    case "hits":
      return <td className={meta}>{row.hits}</td>;
  }
}

/** `<img src=t.gif height=N>` — the spacer the original used for row height. */
function RowSpacer({ height }: { height: number }) {
  const url = chromeUrl("zb_t.gif");
  if (!url) return <div style={{ height }} aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- static export, 43 B spacer
  return <img src={url} alt="" width={1} height={height} className="block" />;
}

/**
 * The header row, in the skin's own strip: `kritz` is
 * `background:white url(skin/kritz_normal2/title_bg.jpg); height:20px`,
 * `webbus` a 28px row on `title_bg.gif`. Each column shows
 * its image label; anything not recovered falls back to the word.
 */
function HeadRow({ skin, columns }: { skin: ListSkin; columns: readonly Column[] }) {
  const bgAsset =
    skin === "kritz" ? "zb_kritz_title_bg.jpg" : skin === "webbus" ? "gb_title_bg.gif" : null;
  const bg = bgAsset ? chromeUrl(bgAsset) : null;
  const strip =
    skin === "webbus" ? "h-[28px] bg-white" : skin === "kritz" ? "h-[20px] bg-white" : "";

  return (
    <tr
      className={`text-forg-muted text-[11px] ${bg ? strip : "bg-(--era-content-bg)"}`}
      style={bg ? { backgroundImage: `url(${bg})`, backgroundRepeat: "repeat-x" } : undefined}
    >
      {columns.map((c) => {
        const url = skin === "plain" ? null : chromeUrl(c.head.asset);
        return (
          <th key={c.key} scope="col" className={`py-[3px] font-normal ${c.th ?? ""}`}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export, recovered header label
              <img
                src={url}
                alt={c.head.label}
                width={c.head.width}
                height={c.head.height}
                className="inline-block align-middle"
              />
            ) : c.labelHidden ? (
              <span className="sr-only">{c.head.label}</span>
            ) : (
              c.head.label
            )}
          </th>
        );
      })}
    </tr>
  );
}

/** Under the header: `webbus` drew a 3px `title_shadow.gif`, the others a 1px rule. */
function HeadRule({ skin, span }: { skin: ListSkin; span: number }) {
  const shadow = skin === "webbus" ? chromeUrl("gb_title_shadow.gif") : null;
  return (
    <tr aria-hidden>
      <td
        colSpan={span}
        className={shadow ? "h-[3px] p-0" : "h-px bg-(--era-input-border)/40 p-0"}
        style={
          shadow ? { backgroundImage: `url(${shadow})`, backgroundRepeat: "repeat-x" } : undefined
        }
      />
    </tr>
  );
}

/**
 * The comment count after a title, in each skin's own form: `kritz`
 * `<font style=font-family:Tahoma;font-size:7pt;>[4]</font>`, `webbus`
 * `<span style='font-family:Tahoma;font-size:10px;color:#EE5A00;'><b>(19)</b></span>`.
 */
export function CommentCount({ count, skin }: { count: number; skin: ListSkin }) {
  if (count <= 0) return null;
  if (skin === "webbus") {
    return (
      <span className="text-webbus-comment shrink-0 font-[Tahoma,sans-serif] text-[10px] font-bold tabular-nums">
        ({count})
      </span>
    );
  }
  return (
    <span className="shrink-0 font-[Tahoma,sans-serif] text-[7pt] tabular-nums">[{count}]</span>
  );
}

/**
 * What follows the count. `webbus` drew `icon_file.gif` for an attachment and
 * `icon_hot.gif` for a hot post, in that order; the Zeroboard list skins drew
 * neither, and the museum keeps its `⊕N` hint there. A row whose hit count
 * did not survive gets no `icon_hot` rather than a guessed one.
 */
export function RowMarks({
  skin,
  board,
  attachmentCount,
  hits,
}: {
  skin: ListSkin;
  board: string;
  attachmentCount: number;
  hits: number | null;
}) {
  if (skin === "webbus") {
    const file = attachmentCount > 0 ? chromeUrl("gb_icon_file.gif") : null;
    const hot = isHot(board, hits) ? chromeUrl("gb_icon_hot.gif") : null;
    return (
      <>
        {file && <MarkIcon url={file} width={9} height={9} label={`첨부 ${attachmentCount}개`} />}
        {hot && <MarkIcon url={hot} width={11} height={9} label="조회 많음" />}
      </>
    );
  }
  if (attachmentCount <= 0) return null;
  return (
    <span
      aria-label={`첨부 ${attachmentCount}개`}
      className="text-forg-muted shrink-0 text-[10.5px] tabular-nums"
    >
      ⊕{attachmentCount}
    </span>
  );
}

function MarkIcon({
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
    // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 9–11 px skin icon
    <img src={url} alt={label} width={width} height={height} className="shrink-0 self-center" />
  );
}
