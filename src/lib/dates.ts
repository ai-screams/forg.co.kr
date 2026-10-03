/**
 * Date formatting helpers for the museum.
 *
 * 619 posts (UoBoard 416 · Sell 55 · Q_A 38 · Tbalhae 31 · Tarirang 27 ·
 * monster 17 · ScreenShot 8 · Vendor 0-ish · ...) ship with a literal
 * `1970년 01월 01일 09시 00분 00초` createdAt. That's not a parser bug — the
 * Zeroboard HTML itself rendered the date that way (NULL DB timestamp
 * placeholder). For accuracy we preserve the value in the JSON. For UX we
 * hide it: rendering `1970-01-01` to a 2026 visitor would look like a bug.
 *
 * The components used to inline these formatters. Centralising here means
 * the `isUnknown` guard lives in one place and the Unicode `—` / Korean
 * "작성일 미상" copy stays consistent across listing + post view.
 */

const UNKNOWN_DATE_YEAR_THRESHOLD = 1990;

/**
 * Every stored date is Korean wall-clock time: `YYYY-MM-DDThh:mm:ss` (posts,
 * comments, index rows), a bare `YYYY-MM-DD` (list-page rows), and on
 * forg.kr's boards the same with `+09:00`. They are read as digits, not
 * through `Date`, which took the build machine's time zone: on the UTC build
 * the `+09:00` comments printed nine hours early, and west of UTC a bare date
 * printed a day early.
 */
const ISO_PARTS = /(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/;

interface DateParts {
  y: string;
  mo: string;
  d: string;
  /** Hour, minute, second; null for a bare `YYYY-MM-DD`. */
  time: [string, string, string] | null;
}

/** The stored digits, placeholders included, or null for a malformed value. */
function digitsOf(iso: string): DateParts | null {
  const m = ISO_PARTS.exec(iso);
  if (!m) return null;
  const [, y = "", mo = "", d = "", hh, mm = "00", ss = "00"] = m;
  return { y, mo, d, time: hh === undefined ? null : [hh, mm, ss] };
}

/** The stored digits, or null for a placeholder or malformed date. */
function partsOf(iso: string): DateParts | null {
  const p = digitsOf(iso);
  return p && Number(p.y) >= UNKNOWN_DATE_YEAR_THRESHOLD ? p : null;
}

/** Wayback / Zeroboard NULL-timestamp placeholder check. */
export function isUnknownDate(iso: string): boolean {
  return partsOf(iso) === null;
}

/**
 * Full Korean datetime for the post-view header and comment timestamps,
 * `2001. 05. 10. 13:05` as `Intl` printed it for ko-KR. Returns "작성일 미상"
 * for 1970-epoch placeholders; the caller can show `capturedAt` as context if
 * a fallback date is useful.
 */
export function formatKoreanDateTime(iso: string): string {
  const p = partsOf(iso);
  if (!p) return "작성일 미상";
  const [hh, mm] = p.time ?? ["00", "00"];
  return `${p.y}. ${p.mo}. ${p.d}. ${hh}:${mm}`;
}

/**
 * Compact YY.MM.DD. form for board listings. Returns an em-dash for unknown
 * dates so the listing column stays narrow.
 */
export function formatShortDate(iso: string): string {
  const p = partsOf(iso);
  if (!p) return "—";
  return `${p.y.slice(2)}.${p.mo}.${p.d}.`;
}

/** `MM/DD` for the 2003 and 2001 home boxes, or an em-dash for unknown dates. */
export function formatMonthDay(iso: string): string {
  const p = partsOf(iso);
  if (!p) return "—";
  return `${p.mo}/${p.d}`;
}

/**
 * `YYYY/MM/DD` as the Zeroboard skins printed it (the 2001 lists, the kritz
 * comment strip). Prints a placeholder's digits as stored; callers that hide
 * placeholders check `isUnknownDate` first.
 */
export function formatSlashDate(iso: string): string {
  const p = digitsOf(iso);
  return p ? `${p.y}/${p.mo}/${p.d}` : "";
}

/** `MM-DD hh:mm`, the webbus comment strip. */
export function formatMonthDayTime(iso: string): string {
  const p = digitsOf(iso);
  if (!p) return "";
  const [hh, mm] = p.time ?? ["00", "00"];
  return `${p.mo}-${p.d} ${hh}:${mm}`;
}

/** `YYYY년 MM월 DD일`. */
export function formatKoreanDay(iso: string): string {
  const p = digitsOf(iso);
  return p ? `${p.y}년 ${p.mo}월 ${p.d}일` : "";
}

/**
 * `YYYY년 MM월 DD일 hh시 mm분 ss초`, the 2001 skins' date tooltip; a row that
 * carries only a date (list pages printed no time) gets the date alone.
 */
export function formatKoreanFull(iso: string): string {
  const p = digitsOf(iso);
  if (!p?.time) return formatKoreanDay(iso);
  const [hh, mm, ss] = p.time;
  return `${formatKoreanDay(iso)} ${hh}시 ${mm}분 ${ss}초`;
}

/**
 * Format the 14-char Wayback ts (`YYYYMMDDhhmmss`) as a human-readable
 * Korean date. Used to show capture-date context next to a 작성일 미상.
 * Returns the raw input on malformed values (defensive — this never
 * happens in our gold tier, but cheap to guard).
 */
export function formatWaybackTs(ts: string): string {
  if (!/^\d{14}$/.test(ts)) return ts;
  const y = ts.slice(0, 4);
  const mo = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  return `${y}.${mo}.${d}`;
}
