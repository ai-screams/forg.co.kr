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

import Link from "@/components/link";

import { PALETTE_2001, skinAsset2001, type Skin2001 } from "@/lib/skins-2001";

/** What a 2001 row needs beyond `ListRow`'s rendered cells. */
export interface Row2001 {
  key: string;
  title: string;
  href: string | null;
  comments: number;
  author: ReactNode;
  createdAt: string | null;
  hits: number | null;
}

const THM8 = "font-[Tahoma,sans-serif] text-[11px]";

function Img({ skin, file, alt = "" }: { skin: Skin2001; file: string; alt?: string }) {
  const url = skinAsset2001(skin, file);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- static export, recovered skin image at its own size
    <img loading="lazy" src={url} alt={alt} className="inline-block align-middle" />
  ) : null;
}

function dateCell(iso: string | null): ReactNode {
  if (!iso) return null;
  const [d = "", t = ""] = iso.split("T");
  const [y, m, day] = d.split("-");
  const [hh = "00", mm = "00", ss = "00"] = t.replace(/[+Z].*$/, "").split(":");
  return (
    <span title={`${y ?? ""}년 ${m ?? ""}월 ${day ?? ""}일 ${hh}시 ${mm}분 ${ss.slice(0, 2)}초`}>
      {y}/{m}/{day}
    </span>
  );
}

function TitleCell({ skin, row }: { skin: Skin2001; row: Row2001 }) {
  return (
    <td className="px-[2px] pt-[3px] text-left break-all">
      <Img skin={skin} file="old_head.gif" />
      &nbsp;
      {row.href ? (
        <Link href={row.href} className="text-(--era-link) hover:text-(--era-link-hover)">
          {row.title}
        </Link>
      ) : (
        <span title="본문은 캡처되지 않았습니다">{row.title}</span>
      )}
      {skin !== "n_board" && row.comments > 0 && (
        <span className="font-[Tahoma,sans-serif] text-[9px]"> [{row.comments}]</span>
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
  rows: readonly Row2001[];
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
                    <td className={`${THM8} w-[100px]`}>{dateCell(row.createdAt)}</td>
                    <TitleCell skin={skin} row={row} />
                    <td className={`${THM8} w-[20px]`}>{row.hits ?? ""}</td>
                  </tr>
                </RowWithRule>
              ))}
            </tbody>
          </>
        ) : (
          <>
            <thead>
              <tr className="h-[23px]" style={{ background: label }}>
                <td className="w-[33px] whitespace-nowrap">
                  <Img skin={skin} file="last_left.gif" />
                  <Img skin={skin} file="title_no.gif" alt="No" />
                </td>
                <td className="text-left">
                  <Img skin={skin} file="title_title.gif" alt="Subject" />
                </td>
                <td className="w-[100px]" />
                <td className="w-[80px]" />
                <td className="w-[23px] text-right">
                  <Img skin={skin} file="last_right.gif" />
                </td>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <RowWithRule key={row.key} span={5}>
                  <tr className="h-[20px] bg-[#fefdfd] text-center">
                    <td className={THM8}>{firstNumber - i}</td>
                    <TitleCell skin={skin} row={row} />
                    <td className="truncate break-all">{row.author}</td>
                    <td className={THM8}>{dateCell(row.createdAt)}</td>
                    <td className={THM8}>{row.hits ?? ""}</td>
                  </tr>
                </RowWithRule>
              ))}
            </tbody>
          </>
        )}
      </table>
      <div className="h-px" style={{ background: accent }} />
    </div>
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
