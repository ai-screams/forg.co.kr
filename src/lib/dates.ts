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

/** Wayback / Zeroboard NULL-timestamp placeholder check. */
export function isUnknownDate(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return true;
  return d.getFullYear() < UNKNOWN_DATE_YEAR_THRESHOLD;
}

const KOREAN_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Full Korean datetime for the post-view header and comment timestamps.
 * Returns "작성일 미상" for 1970-epoch placeholders; the caller can show
 * `capturedAt` as context if a fallback date is useful.
 */
export function formatKoreanDateTime(iso: string): string {
  if (isUnknownDate(iso)) return "작성일 미상";
  const d = new Date(iso);
  return KOREAN_DATE_FORMATTER.format(d);
}

/**
 * Compact YY.MM.DD form for board listings. Returns an em-dash for unknown
 * dates so the listing column stays narrow.
 */
export function formatShortDate(iso: string): string {
  if (isUnknownDate(iso)) return "—";
  const d = new Date(iso);
  return SHORT_DATE_FORMATTER.format(d).replace(/\s/g, "");
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
