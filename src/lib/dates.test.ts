import { describe, expect, test } from "vitest";

import {
  formatKoreanDateTime,
  formatKoreanFull,
  formatMonthDay,
  formatMonthDayTime,
  formatShortDate,
  formatSlashDate,
  formatWaybackTs,
  isUnknownDate,
} from "@/lib/dates";

// Zeroboard's NULL-timestamp placeholder, as the gold JSON keeps it.
const PLACEHOLDER = "1970-01-01T09:00:00";

describe("placeholder dates", () => {
  test("a 1970 date or a malformed value is unknown", () => {
    expect(isUnknownDate(PLACEHOLDER)).toBe(true);
    expect(isUnknownDate("")).toBe(true);
    expect(isUnknownDate("2003-05-10T13:05:00")).toBe(false);
  });

  test("the hiding formatters print a stand-in, not 1970", () => {
    expect(formatShortDate(PLACEHOLDER)).toBe("—");
    expect(formatMonthDay(PLACEHOLDER)).toBe("—");
    expect(formatKoreanDateTime(PLACEHOLDER)).toBe("작성일 미상");
  });

  test("the skin formatters print the stored digits; callers check first", () => {
    expect(formatSlashDate(PLACEHOLDER)).toBe("1970/01/01");
  });
});

describe("Korean wall-clock dates are read as digits", () => {
  test("a forg.kr +09:00 time keeps its hour whatever the build's zone", () => {
    expect(formatKoreanDateTime("2019-07-17T20:59:00+09:00")).toBe("2019. 07. 17. 20:59");
  });

  test("a bare list-page date keeps its day", () => {
    expect(formatShortDate("2003-05-10")).toBe("03.05.10.");
    expect(formatKoreanFull("2003-05-10")).toBe("2003년 05월 10일");
  });
});

describe("each format", () => {
  const iso = "2003-05-10T13:05:07";
  test.each([
    [formatShortDate, "03.05.10."],
    [formatMonthDay, "05/10"],
    [formatSlashDate, "2003/05/10"],
    [formatMonthDayTime, "05-10 13:05"],
    [formatKoreanDateTime, "2003. 05. 10. 13:05"],
    [formatKoreanFull, "2003년 05월 10일 13시 05분 07초"],
  ])("%o", (format, expected) => {
    expect(format(iso)).toBe(expected);
  });

  test("a Wayback timestamp, and a malformed one passed through", () => {
    expect(formatWaybackTs("20030902080926")).toBe("2003.09.02");
    expect(formatWaybackTs("2003")).toBe("2003");
  });
});
