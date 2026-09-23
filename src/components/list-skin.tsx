/**
 * Pieces of the original board-list skins shared by `<BoardListing>` and
 * `<BoardListingOnly>`, which draw the same table.
 *
 * Zeroboard boards wore one of five `kritz_*` skins. Every header label
 * recovered for more than one of them has the same bytes in each (md5 over
 * `public/img/chrome/zb_kritz*_title_*`), so the `kritz_normal2` set
 * (`zb_kritz_*`) stands for all five. Gnuboard boards (the 2014 `webbus2009_basic`
 * skin) keep text headers: that skin's header is a CSS strip, not images.
 */

import { chromeUrl } from "@/lib/chrome";

export interface ListColumn {
  /** Recovered `title_*.gif` label, drawn at its own size. */
  asset: string;
  width: number;
  height: number;
  /** Text header, and the image's alt. */
  label: string;
  /** Extra classes for the `<th>` (visibility, alignment). */
  className?: string;
  /** The status column had an icon, not a word, in the original too. */
  labelHidden?: boolean;
}

/** Status · 이름 · 제목 · 날짜 · 조회, in the order `kritz_normal2` drew them. */
export const KRITZ_COLUMNS = {
  icon: {
    asset: "zb_kritz_title_icon.gif",
    width: 13,
    height: 9,
    label: "상태",
    labelHidden: true,
  },
  name: {
    asset: "zb_kritz_title_name.gif",
    width: 33,
    height: 12,
    label: "이름",
    className: "hidden sm:table-cell",
  },
  title: {
    asset: "zb_kritz_title_title.gif",
    width: 56,
    height: 12,
    label: "제목",
    className: "text-left pl-1",
  },
  date: { asset: "zb_kritz_title_date.gif", width: 9, height: 12, label: "날짜" },
  hit: { asset: "zb_kritz_title_hit.gif", width: 11, height: 12, label: "조회" },
} as const satisfies Record<string, ListColumn>;

/**
 * The header row. For Zeroboard boards it is the original strip —
 * `background:white url(skin/kritz_normal2/title_bg.jpg); height:20px` with
 * an image label per column; anything not recovered falls back to the word.
 */
export function ListHeadRow({
  columns,
  zeroboard,
}: {
  columns: readonly ListColumn[];
  zeroboard: boolean;
}) {
  const bg = zeroboard ? chromeUrl("zb_kritz_title_bg.jpg") : null;

  return (
    <tr
      className={`text-forg-muted text-[11px] ${bg ? "h-[20px] bg-white" : "bg-(--era-content-bg)"}`}
      style={bg ? { backgroundImage: `url(${bg})`, backgroundRepeat: "repeat-x" } : undefined}
    >
      {columns.map((col) => {
        const url = zeroboard ? chromeUrl(col.asset) : null;
        return (
          <th key={col.asset} scope="col" className={`py-[3px] font-normal ${col.className ?? ""}`}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element -- static export, recovered header label
              <img
                src={url}
                alt={col.label}
                width={col.width}
                height={col.height}
                className="inline-block align-middle"
              />
            ) : col.labelHidden ? (
              <span className="sr-only">{col.label}</span>
            ) : (
              col.label
            )}
          </th>
        );
      })}
    </tr>
  );
}

/**
 * The comment count after a title, in each engine's own form: Zeroboard
 * `<font style=font-family:Tahoma;font-size:7pt;>[4]</font>`, Gnuboard's
 * `webbus2009_basic` `<span style='font-family:Tahoma;font-size:10px;
 * color:#EE5A00;'><b>(19)</b></span>`.
 */
export function CommentCount({ count, zeroboard }: { count: number; zeroboard: boolean }) {
  if (count <= 0) return null;
  return zeroboard ? (
    <span className="shrink-0 font-[Tahoma,sans-serif] text-[7pt] tabular-nums">[{count}]</span>
  ) : (
    <span className="text-webbus-comment shrink-0 font-[Tahoma,sans-serif] text-[10px] font-bold tabular-nums">
      ({count})
    </span>
  );
}
