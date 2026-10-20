/**
 * The board-list table, drawn in the skin the board wore, for `<BoardListing>`.
 *
 * The skin comes from the board's engine (`lib/skins.ts` `boardSkin`); its
 * columns, per the 707 captured list pages:
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
 *
 * Notices and replies are marked as each skin marked them, on the rows a
 * captured list showed as such (`ListRow.notice`, `replyDepth`): `kritz` puts
 * `list_notice.gif` or `reply_head.gif` in the status cell and greys a
 * notice's row (#F2F2F2); `webbus` prints `icon_notice.gif` for a notice's
 * number on a #FAFAFA row and `icon_reply.gif` before a reply's title,
 * indented two `&nbsp;` a level.
 */

import { AuthorName } from "@/components/author-name";
import { ChromeImg } from "@/components/chrome-img";
import type { ListRow } from "@/components/list-row";
import { ListTable2001 } from "@/components/list-skin-2001";
import { chromeUrl, tileStyle } from "@/lib/chrome";
import type { ListSkin } from "@/lib/skins";
import type { Skin2001 } from "@/lib/skins-2001";

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
  /** The 2001 skin's strip and counts (`list-skin-2001`), which draws the same rows itself. */
  era2001: {
    skin: Skin2001;
    totalPosts: number;
    page: number;
    totalPages: number;
  };
}) {
  const columns = columnsFor(skin, withHits);

  return (
    <>
      <NarrowList rows={rows} skin={skin} />
      <div className="era-2001-only hidden sm:block">
        <ListTable2001 rows={rows} firstNumber={firstNumber} {...era2001} />
      </div>
      <div className="forg-skin-table hidden border border-(--era-input-border)/50 bg-white sm:block">
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
              <tr
                key={row.key}
                className={[
                  "border-b border-(--era-input-border)/25 last:border-0",
                  row.notice ? NOTICE_ROW[skin] : "",
                ].join(" ")}
              >
                {columns.map((c) => (
                  <Cell key={c.key} column={c.key} skin={skin} row={row} number={firstNumber - i} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** A notice's row, in the skin's own grey; `plain` borrows the era's panel. */
const NOTICE_ROW: Readonly<Record<ListSkin, string>> = {
  kritz: "bg-kritz-notice-row",
  webbus: "bg-webbus-notice-row",
  plain: "bg-(--era-content-bg)",
};

/**
 * Below `sm` (640px) the fixed-column table has no room: the title ran over
 * the date and the number column squeezed both. A phone gets one row per
 * post in two lines — the title, then name · date — and the skins' header
 * art is left to wider screens, where the table is exactly as before. A
 * notice keeps its row colour and gets a 공지 tag, a reply an arrow: the
 * museum's marks, since the skins' icons sat in columns a phone drops.
 *
 * 2026 draws a list this way at every width (`.forg-narrow-list` in
 * `src/styles/era-2026.css`); `forg-notice` and `forg-num` are its hooks.
 */
function NarrowList({ rows, skin }: { rows: readonly ListRow[]; skin: ListSkin }) {
  return (
    <ul className="forg-narrow-list border border-(--era-input-border)/50 bg-white sm:hidden">
      {rows.map((row) => (
        <li
          key={row.key}
          className={[
            "border-b border-(--era-input-border)/25 px-2 py-[6px] text-[13px] last:border-0",
            row.notice ? `forg-notice ${NOTICE_ROW[skin]}` : "",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-baseline gap-1">
            {row.notice && (
              <span className="shrink-0 rounded-[2px] bg-forg-gold/30 px-[3px] text-[10px] leading-[14px] font-bold text-forg-ink">
                공지
              </span>
            )}
            {row.replyDepth > 0 && (
              <span
                aria-hidden
                className="shrink-0 text-[11px] text-forg-muted"
                style={{ paddingLeft: `${(row.replyDepth - 1) * 0.75}rem` }}
              >
                ↳
              </span>
            )}
            {row.replyDepth > 0 && <span className="sr-only">답글</span>}
            {/* The title link is inline-flex; capping it lets its truncate work. */}
            <div className="min-w-0 overflow-hidden [&>*]:max-w-full">{row.cells.title}</div>
          </div>
          <div className="mt-[2px] flex gap-2 text-[11px] text-forg-muted tabular-nums">
            <span className="truncate">
              <AuthorName {...row.author} seed={row.key} />
            </span>
            <span className="forg-num shrink-0">{row.cells.date}</span>
            {row.cells.hits !== undefined && row.cells.hits !== null && (
              <span className="forg-num shrink-0">조회 {row.cells.hits}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Cell({
  column,
  skin,
  row,
  number,
}: {
  column: ColumnKey;
  skin: ListSkin;
  row: ListRow;
  number: number;
}) {
  const meta = "text-forg-muted text-center align-middle text-[11px] tabular-nums";
  switch (column) {
    case "status":
      // A notice's `list_notice.gif` or a reply's `reply_head.gif`, else
      // blank. The column's other icon, `new_head.gif` ("따끈 따근한글"),
      // marked a post written the day the page was served — 58 of the 71
      // rows that carry it across 707 captured list pages — and every other
      // row got `old_head.gif`, a 1×13 blank. Seen from the museum no post
      // is that fresh. `plain` (forg.kr) has no icons of its own.
      return (
        <td className="text-center align-middle">
          {skin === "kritz" && row.notice ? (
            <MarkIcon
              url={chromeUrl("zb_kritz_list_notice.gif")}
              width={10}
              height={10}
              label="공지"
            />
          ) : skin === "kritz" && row.replyDepth > 0 ? (
            <MarkIcon
              url={chromeUrl("zb_kritzn_reply_head.gif")}
              width={15}
              height={16}
              label="답글"
            />
          ) : (
            <RowSpacer height={3} />
          )}
        </td>
      );
    case "num":
      // `<span style='font:normal 9px tahoma; color:#B3B3B3;'>594</span>`;
      // a notice's number is `icon_notice.gif`.
      return (
        <td className="text-center align-middle font-[Tahoma,sans-serif] text-[9px] text-webbus-num tabular-nums">
          {row.notice ? (
            <MarkIcon url={chromeUrl("gb_icon_notice.gif")} width={34} height={9} label="공지" />
          ) : (
            number
          )}
        </td>
      );
    case "name":
      return (
        <td className="truncate px-1 text-center align-middle text-[11px] text-forg-muted">
          <AuthorName {...row.author} seed={row.key} />
        </td>
      );
    case "title":
      return (
        <td className="px-1 align-middle break-all">
          {skin === "webbus" && row.replyDepth > 0 && (
            <>
              {"\u00a0\u00a0".repeat(row.replyDepth)}
              <MarkIcon url={chromeUrl("gb_icon_reply.gif")} width={9} height={9} label="답글" />
            </>
          )}
          {row.cells.title}
        </td>
      );
    case "date":
      return <td className={meta}>{row.cells.date}</td>;
    case "hits":
      return <td className={meta}>{row.cells.hits}</td>;
  }
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
    <ChromeImg
      src={url}
      alt={label}
      width={width}
      height={height}
      className="inline-block align-middle"
    />
  );
}

/** `<img src=t.gif height=N>` — the spacer the original used for row height. */
function RowSpacer({ height }: { height: number }) {
  return (
    <ChromeImg src={chromeUrl("zb_t.gif")} alt="" width={1} height={height} className="block" />
  );
}

/**
 * The header row, in the skin's own strip: `kritz` is
 * `background:white url(skin/kritz_normal2/title_bg.jpg); height:20px`,
 * `webbus` a 28px row on `title_bg.gif`. Each column shows its image label;
 * `plain` has no art and shows the words.
 */
function HeadRow({ skin, columns }: { skin: ListSkin; columns: readonly Column[] }) {
  const bgAsset =
    skin === "kritz" ? "zb_kritz_title_bg.jpg" : skin === "webbus" ? "gb_title_bg.gif" : null;
  const bg = bgAsset ? chromeUrl(bgAsset) : null;
  const strip =
    skin === "webbus" ? "h-[28px] bg-white" : skin === "kritz" ? "h-[20px] bg-white" : "";

  return (
    <tr
      className={`text-[11px] text-forg-muted ${bg ? strip : "bg-(--era-content-bg)"}`}
      style={tileStyle(bg, "repeat-x")}
    >
      {columns.map((c) => {
        const url = skin === "plain" ? null : chromeUrl(c.head.asset);
        return (
          <th key={c.key} scope="col" className={`py-[3px] font-normal ${c.th ?? ""}`}>
            {url ? (
              <ChromeImg
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
        style={tileStyle(shadow, "repeat-x")}
      />
    </tr>
  );
}
