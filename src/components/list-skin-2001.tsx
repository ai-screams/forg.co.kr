/**
 * The board list as a 2001 Zeroboard 4.0 skin drew it (ADR-0019), shown in
 * the 2001 era in place of `<ListTable>`'s desktop table.
 *
 * N+gine (skyblue, board, pink, yellow, y, htred), from `LZ/Q_A/z-page-8`
 * (2001-05-31) and its siblings:
 *
 *   total 4347 articles 87 page 1                         (Tahoma 7pt)
 *   [title_bg: last_left · title_no (30) · title_title · · · last_right]
 *   2701 │ old_head 제목 [9]          │ Jinsoo │ 2001/05/10 │ 77   #FEFDFD, 20px
 *   ─────────────────── 1px #e0e0e0 ─────────────────────────────────
 *   ═══════════════════ 1px accent ══════════════════════════════════
 *
 * n_board (Notice, Events), from `LZ/Notice/z-page-1` (2001-08-04): a "News"
 * strip, then date (100) · title · hits (20) on #FEFEFE.
 *
 * `title_bg.gif` and n_board's `lh_bg.gif` were never captured; the strips
 * take the skin's label colour (N+gine) and its accent (n_board) instead.
 * Rows link where a post was kept and are plain text where only the list row
 * survives; dates print as the skins did, `YYYY/MM/DD`, with the full time as
 * a tooltip.
 */

import type { ReactNode } from "react";

import { AuthorName } from "@/components/author-name";
import Link from "@/components/link";

import { DATE_APPROX, NO_BODY_TOOLTIP, type ListRow } from "@/components/list-row";
import { SkinImg2001 } from "@/components/skin-img-2001";
import { formatKoreanDay, formatKoreanFull, formatSlashDate, isUnknownDate } from "@/lib/dates";
import { PALETTE_2001, type Skin2001 } from "@/lib/skins-2001";

const THM8 = "font-[Tahoma,sans-serif] text-[11px]";

/**
 * `YYYY/MM/DD` with the full time as a tooltip, as the skins printed it. A
 * row the museum knows only from a list page has a date and no time (the
 * index stores it at 00:00:00), so its tooltip is the date alone. An
 * approximate date carries the same mark and tooltip as in the 2014/2003
 * lists (`DATE_APPROX`), and Zeroboard's NULL-date placeholder (1970) reads
 * "—" as there.
 */
function dateCell(row: ListRow): ReactNode {
  const iso = row.createdAt;
  if (!iso) return null;
  if (isUnknownDate(iso)) return "—";
  if (row.dateApprox) {
    const { mark, tooltip } = DATE_APPROX[row.dateApprox];
    return (
      <span title={tooltip}>
        {mark}
        {formatSlashDate(iso)}
      </span>
    );
  }
  return (
    <span title={row.href ? formatKoreanFull(iso) : formatKoreanDay(iso)}>
      {formatSlashDate(iso)}
    </span>
  );
}

function TitleCell({
  skin,
  row,
  withCount,
}: {
  skin: Skin2001;
  row: ListRow;
  /** N+gine printed the comment count after a title; n_board did not. */
  withCount: boolean;
}) {
  return (
    <td className="px-[2px] pt-[3px] text-left break-all">
      <SkinImg2001 skin={skin} file="old_head.gif" />
      &nbsp;
      {row.href ? (
        <Link href={row.href} className="text-(--era-link) hover:text-(--era-link-hover)">
          {row.title}
        </Link>
      ) : (
        <span title={NO_BODY_TOOLTIP}>{row.title}</span>
      )}
      {withCount && row.commentCount > 0 && (
        <span className="font-[Tahoma,sans-serif] text-[9px]"> [{row.commentCount}]</span>
      )}
    </td>
  );
}

export function ListTable2001({
  skin,
  rows,
  firstNumber,
  totalPosts,
  page,
  totalPages,
}: {
  skin: Skin2001;
  rows: readonly ListRow[];
  firstNumber: number;
  totalPosts: number;
  page: number;
  totalPages: number;
}) {
  const { label, accent } = PALETTE_2001[skin];
  return (
    <div className="mx-auto w-[95%] bg-white text-[12px]">
      <p className={`py-[2px] font-[Tahoma,sans-serif] text-[9px] text-black`}>
        total <b style={{ color: accent }}>{totalPosts}</b> articles{" "}
        <b style={{ color: accent }}>{totalPages}</b> page <b style={{ color: accent }}>{page}</b>
      </p>
      <table className="w-full border-collapse">
        {skin === "n_board" ? (
          <NewsRows rows={rows} accent={accent} />
        ) : (
          <NgineRows skin={skin} rows={rows} label={label} firstNumber={firstNumber} />
        )}
      </table>
      <div className="h-px" style={{ background: accent }} />
    </div>
  );
}

/** n_board: a "News" strip, then date · title · hits. */
function NewsRows({ rows, accent }: { rows: readonly ListRow[]; accent: string }) {
  return (
    <>
      <thead>
        <tr>
          <td colSpan={3} className="h-[18px] text-white" style={{ background: accent }}>
            <b className="pl-6 font-[Tahoma,sans-serif] text-[9px]">News</b>
          </td>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <RowWithRule key={row.key} span={3}>
            <tr className="bg-[#fefefe] text-center">
              <td className={`${THM8} w-[100px]`}>{dateCell(row)}</td>
              <TitleCell skin="n_board" row={row} withCount={false} />
              <td className={`${THM8} w-[20px]`}>{row.hits ?? ""}</td>
            </tr>
          </RowWithRule>
        ))}
      </tbody>
    </>
  );
}

/** N+gine: the title_bg header, then number · title · name · date · hits. */
function NgineRows({
  skin,
  rows,
  label,
  firstNumber,
}: {
  skin: Exclude<Skin2001, "n_board">;
  rows: readonly ListRow[];
  label: string;
  firstNumber: number;
}) {
  return (
    <>
      <thead>
        <tr className="h-[23px]" style={{ background: label }}>
          <td className="w-[33px] whitespace-nowrap">
            <SkinImg2001 skin={skin} file="last_left.gif" />
            <SkinImg2001 skin={skin} file="title_no.gif" alt="No" />
          </td>
          <td className="text-left">
            <SkinImg2001 skin={skin} file="title_title.gif" alt="Subject" />
          </td>
          <td className="w-[100px]" />
          <td className="w-[80px]" />
          <td className="w-[23px] text-right">
            <SkinImg2001 skin={skin} file="last_right.gif" />
          </td>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <RowWithRule key={row.key} span={5}>
            <tr className="h-[20px] bg-[#fefdfd] text-center">
              <td className={THM8}>{firstNumber - i}</td>
              <TitleCell skin={skin} row={row} withCount />
              <td className="truncate break-all">
                <AuthorName {...row.author} seed={row.key} />
              </td>
              <td className={THM8}>{dateCell(row)}</td>
              <td className={THM8}>{row.hits ?? ""}</td>
            </tr>
          </RowWithRule>
        ))}
      </tbody>
    </>
  );
}

function RowWithRule({ span, children }: { span: number; children: ReactNode }) {
  return (
    <>
      {children}
      <tr>
        <td colSpan={span} className="h-px bg-[#e0e0e0] p-0" />
      </tr>
    </>
  );
}
