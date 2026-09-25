/**
 * Canonical metadata for every forg.co.kr board the museum reproduces.
 *
 * This is the single source of truth for Korean display names, engine
 * provenance, and default era hints. The Python ETL parsers do not
 * duplicate this catalog — the React side reads `BOARDS[id].nameKr` at
 * render time. The `boardKr` field on `Post` JSON is legacy (set to the
 * English id by the parser) and will be removed in a follow-up commit.
 *
 * Inventory comes from `.docs/research/FORG-RECONSTRUCTION-GUIDE.md` §4
 * (메뉴/게시판 전수 목록) cross-referenced with
 * `.docs/research/cdx/e-policy-plan.json` capture counts.
 *
 * forg.co.kr 의 WoW 부속 보드 (WOWNotice / WowForum / WOWEvents /
 * WOWScreen / WowRole) 와 newbieqna 는 P3.3 Phase C 에서 다운로드 +
 * 등록 (대다수는 회원전용 권한 페이지였으나 박물관 promise 보존을 위해
 * URL 유지 — `<BoardPlaceholder>` 자동 렌더링, ADR-0013).
 * forg.kr 후속 사이트 보드는 `kr_` prefix 로 별도 등록 (P2.3).
 */

import type { PostEra, SourceEngine } from "@/types/post";

/** Top-level grouping used for sidebar sections and listings. */
export type BoardCategory = "uo" | "community" | "trade" | "guide" | "other";

export interface BoardMeta {
  /** Stable id matching `Post.board` and post directory names. */
  id: string;
  /** Korean display name shown in headers, breadcrumbs, and listings. */
  nameKr: string;
  category: BoardCategory;
  /** Engine that produced the historical markup. Drives parser routing. */
  engine: SourceEngine;
  /**
   * Era this board was primarily active in. The site's runtime era
   * toggle is independent — this is just a hint so newly-clicked boards
   * can default to a sensible chrome.
   */
  era: PostEra;
  /** One-line description rendered above the post list. */
  description?: string;
}

/**
 * Board catalog. The `as const satisfies` pattern keeps each entry's
 * literal types (so `BOARDS.Notice.category` narrows to `"uo"`) while
 * still validating shape conformance.
 */
export const BOARDS = {
  // ── uo (UO core, 2003 era — Zeroboard) ──
  Notice: {
    id: "Notice",
    nameKr: "공지사항",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
    description: "UO 패치 노트와 운영 공지",
  },
  column: {
    id: "column",
    nameKr: "UO 컬럼",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
  },
  UoBoard: {
    id: "UoBoard",
    nameKr: "자유게시판 (Zeroboard)",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
    description: "Zeroboard 시절 자유게시판 — 2003~2010 핵심 트래픽",
  },
  Q_A: {
    id: "Q_A",
    nameKr: "질문답변",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
  },
  Role: {
    id: "Role",
    nameKr: "롤플레이",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
  },
  UOForum: {
    id: "UOForum",
    nameKr: "우오월드라 (에세이)",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
  },
  ScreenShot: {
    id: "ScreenShot",
    nameKr: "스크린샷",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
  },
  screen: {
    id: "screen",
    // Served only from forg.uospace.net/zb/ in 2001 (phase U). No capture
    // carries the board's display name, so this one only describes it.
    nameKr: "스크린샷 (2001)",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
    description: "2001년 forg.uospace.net 시절의 스크린샷 게시판 (이름은 캡처에 남지 않음)",
  },
  HouseScreenshot: {
    id: "HouseScreenshot",
    nameKr: "하우스 스크린샷",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
  },
  Items: {
    id: "Items",
    nameKr: "아이템 스크린샷",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
  },
  Events: {
    id: "Events",
    nameKr: "이벤트",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
  },
  events_date: {
    id: "events_date",
    nameKr: "이벤트 일정",
    category: "uo",
    engine: "zeroboard",
    era: "2003",
  },
  Recall: {
    id: "Recall",
    // The 2003 menu button reads "Kal Ort Por" (the UO recall spell) and
    // the board is a link directory (skin/link: 울온정보사이트, 자료사이트,
    // 배경화면, UO홈…). The guide's "컬럼 자료실" was a guess.
    nameKr: "Kal Ort Por (링크)",
    category: "guide",
    engine: "zeroboard",
    era: "2003",
    description: "UO 사이트 링크 디렉터리 — 정보·자료·배경화면·공식 홈 (2001–2003)",
  },

  // ── uo (UO core, 2014 era — Gnuboard4) ──
  UoBoard2: {
    id: "UoBoard2",
    nameKr: "자유게시판",
    category: "uo",
    engine: "gnuboard4",
    era: "2014",
    description: "Gnuboard4 시절 자유게시판 — 2014 메인 메뉴 첫 버튼",
  },
  Ultima: {
    id: "Ultima",
    nameKr: "울티마온라인",
    category: "uo",
    engine: "gnuboard4",
    era: "2014",
  },

  // ── community ──
  porato: {
    id: "porato",
    nameKr: "포토갤러리",
    category: "community",
    engine: "gnuboard4",
    era: "2014",
    description: "원래 'photo'의 오타가 표준 ID로 굳어진 갤러리",
  },
  FunBoard: {
    id: "FunBoard",
    nameKr: "펀보드",
    category: "community",
    engine: "gnuboard4",
    era: "2014",
  },
  Trash: {
    id: "Trash",
    nameKr: "휴지통게시판",
    category: "community",
    engine: "gnuboard4",
    era: "2014",
  },
  Reveal: {
    id: "Reveal",
    nameKr: "스포일러게시판",
    category: "community",
    engine: "gnuboard4",
    era: "2014",
    description: "2006 진솔 비리 사건이 터졌던 그 게시판",
  },
  Boo: {
    id: "Boo",
    // The 2014 capture's own menu alt text; the reconstruction guide's
    // "검색/문서함" was a guess. Rows are purchase show-offs ("질렀습니다").
    nameKr: "뽐뿌",
    category: "community",
    engine: "gnuboard4",
    era: "2014",
    description: "지름 인증 게시판 (BooBoard)",
  },

  // ── trade ──
  Shop: {
    id: "Shop",
    nameKr: "상점 (거래)",
    category: "trade",
    engine: "gnuboard4",
    era: "2014",
  },
  Vendor: {
    id: "Vendor",
    nameKr: "벤더찾기",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
  },
  Sell: {
    id: "Sell",
    nameKr: "판매",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
  },
  Tarirang: {
    id: "Tarirang",
    nameKr: "아리랑 트레이드",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
  },
  Tbalhae: {
    id: "Tbalhae",
    nameKr: "발해 트레이드",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
  },

  // ── guide ──
  Newbie: {
    id: "Newbie",
    nameKr: "초보자게시판",
    category: "guide",
    engine: "zeroboard",
    era: "2003",
    description: "초보자 안내 게시판 (UO 입문 + 자유 토픽)",
  },
  newbieqna: {
    id: "newbieqna",
    nameKr: "초보 질문답변",
    category: "guide",
    engine: "zeroboard",
    era: "2003",
    description: "초보자 Q&A — Newbie 보드의 자매 게시판",
  },
  knowledge: {
    id: "knowledge",
    nameKr: "지식",
    category: "guide",
    engine: "zeroboard",
    era: "2003",
  },
  monster: {
    id: "monster",
    nameKr: "몬스터광장",
    category: "guide",
    engine: "zeroboard",
    era: "2003",
  },

  // ── other (non-UO games) ──
  DiabloBoard: {
    id: "DiabloBoard",
    // 2001 Diablo II board on the Zeroboard 4.0 install at /zboard/ (phase Z).
    // No capture carries its display name; the id is all there is.
    nameKr: "디아블로 자유게시판",
    category: "other",
    engine: "zeroboard",
    era: "2003",
    description: "2001년 디아블로 II 자유게시판 (이름은 캡처에 남지 않음)",
  },
  Diablo_Notice: {
    id: "Diablo_Notice",
    // 2001 Diablo II board on the Zeroboard 4.0 install at /zboard/ (phase Z).
    // No capture carries its display name; the id is all there is.
    nameKr: "디아블로 공지",
    category: "other",
    engine: "zeroboard",
    era: "2003",
    description: "2001년 디아블로 II 공지 (이름은 캡처에 남지 않음)",
  },
  Diablo_QA: {
    id: "Diablo_QA",
    // 2001 Diablo II board on the Zeroboard 4.0 install at /zboard/ (phase Z).
    // No capture carries its display name; the id is all there is.
    nameKr: "디아블로 질문답변",
    category: "other",
    engine: "zeroboard",
    era: "2003",
    description: "2001년 디아블로 II 질문답변 (이름은 캡처에 남지 않음)",
  },
  Diablo: {
    id: "Diablo",
    nameKr: "디아블로3",
    category: "other",
    engine: "gnuboard4",
    era: "2014",
  },
  DF: {
    id: "DF",
    nameKr: "던전파이터",
    category: "other",
    engine: "gnuboard4",
    era: "2014",
  },
  LoL: {
    id: "LoL",
    nameKr: "리그오브레전드",
    category: "other",
    engine: "gnuboard4",
    era: "2014",
  },
  Star2: {
    id: "Star2",
    nameKr: "스타크래프트2",
    category: "other",
    engine: "gnuboard4",
    era: "2014",
  },
  Console: {
    id: "Console",
    nameKr: "콘솔게임",
    category: "other",
    engine: "gnuboard4",
    era: "2014",
  },

  // ── other (forg.co.kr WoW 부속 보드, 2003 era — Zeroboard) ──
  // 대부분 회원 전용 권한 페이지였음. WOWScreen 만 1건의 공개 캡처 존재.
  // 나머지는 `<BoardPlaceholder>` 자동 렌더링 (ADR-0013).
  WOWNotice: {
    id: "WOWNotice",
    nameKr: "WoW 공지",
    category: "other",
    engine: "zeroboard",
    era: "2003",
  },
  WowForum: {
    id: "WowForum",
    nameKr: "WoW 포럼",
    category: "other",
    engine: "zeroboard",
    era: "2003",
  },
  WOWEvents: {
    id: "WOWEvents",
    nameKr: "WoW 이벤트",
    category: "other",
    engine: "zeroboard",
    era: "2003",
  },
  WOWScreen: {
    id: "WOWScreen",
    nameKr: "WoW 스크린샷",
    category: "other",
    engine: "zeroboard",
    era: "2003",
  },
  WowRole: {
    id: "WowRole",
    nameKr: "WoW 롤플레이",
    category: "other",
    engine: "zeroboard",
    era: "2003",
  },

  // ── forg.kr successor site (Gnuboard5, 2019+) — `kr_` prefix avoids
  // case collisions with forg.co.kr boards on macOS APFS. Lowercase
  // forg.kr ids (`ultima` ↔ forg.co.kr `Ultima`, `notice` ↔ `Notice`)
  // would otherwise resolve to the same filesystem inode.
  kr_notice: {
    id: "kr_notice",
    nameKr: "공지 (forg.kr)",
    category: "uo",
    engine: "gnuboard5",
    era: "2014",
    description: "forg.kr 후속 사이트 공지사항",
  },
  kr_ultima: {
    id: "kr_ultima",
    nameKr: "울티마온라인 (forg.kr)",
    category: "uo",
    engine: "gnuboard5",
    era: "2014",
  },
  kr_free: {
    id: "kr_free",
    nameKr: "자유 (forg.kr)",
    category: "community",
    engine: "gnuboard5",
    era: "2014",
  },
  kr_humorrr: {
    id: "kr_humorrr",
    nameKr: "유머 (forg.kr)",
    category: "community",
    engine: "gnuboard5",
    era: "2014",
  },
  kr_qnaaa: {
    id: "kr_qnaaa",
    nameKr: "질문답변 (forg.kr)",
    category: "guide",
    engine: "gnuboard5",
    era: "2014",
  },
  kr_aseeee: {
    id: "kr_aseeee",
    nameKr: "팁/노하우 (forg.kr)",
    category: "guide",
    engine: "gnuboard5",
    era: "2014",
  },
  kr_dataaa: {
    id: "kr_dataaa",
    nameKr: "자료실 (forg.kr)",
    category: "guide",
    engine: "gnuboard5",
    era: "2014",
  },
  kr_gonggg: {
    id: "kr_gonggg",
    nameKr: "공략 (forg.kr)",
    category: "guide",
    engine: "gnuboard5",
    era: "2014",
  },
  kr_screee: {
    id: "kr_screee",
    nameKr: "스크린샷 (forg.kr)",
    category: "community",
    engine: "gnuboard5",
    era: "2014",
  },
  kr_trtrtr: {
    id: "kr_trtrtr",
    nameKr: "거래 (forg.kr)",
    category: "trade",
    engine: "gnuboard5",
    era: "2014",
  },

  // ── boards known only from captured list pages (ADR-0017 §4) ──
  // No post page of these was ever captured; `src/content/listings/{id}.json`
  // holds the rows. Names follow the rows' subject where the id is a
  // game (아이온, 헬게이트, 마비노기…); `Co` is UO bard columns (2004).
  Aion: {
    id: "Aion",
    nameKr: "아이온",
    category: "other",
    engine: "zeroboard",
    era: "2003",
    description: "아이온 클로즈베타 시절 (2007–2008), 목록만 남음",
  },
  Co: {
    id: "Co",
    nameKr: "바드 자료",
    category: "guide",
    engine: "zeroboard",
    era: "2003",
    description: "UO 바드 스킬 해설 (2004), 목록만 남음",
  },
  HG: {
    id: "HG",
    nameKr: "헬게이트: 런던",
    category: "other",
    engine: "zeroboard",
    era: "2003",
    description: "2007–2008, 목록만 남음",
  },
  Mabi: {
    id: "Mabi",
    nameKr: "마비노기",
    category: "other",
    engine: "gnuboard4",
    era: "2014",
    description: "2010, 목록만 남음",
  },
  MabiHero: {
    id: "MabiHero",
    nameKr: "마비노기 영웅전",
    category: "other",
    engine: "zeroboard",
    era: "2003",
    description: "2007–2008, 목록만 남음",
  },
  Replay: {
    id: "Replay",
    nameKr: "스타크래프트 리플레이",
    category: "other",
    engine: "zeroboard",
    era: "2003",
    description: "2005, 목록만 남음",
  },
  Tarirang2: {
    id: "Tarirang2",
    nameKr: "타리랑 거래 (신)",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
    description: "2004, 목록만 남음 — 구 게시판은 Tarirang",
  },
  WoW: {
    id: "WoW",
    nameKr: "WoW 게시판",
    category: "other",
    engine: "zeroboard",
    era: "2003",
    description: "2007–2008, 목록만 남음",
  },
  WOWCo: {
    id: "WOWCo",
    nameKr: "WoW 퀘스트 정보",
    category: "other",
    engine: "zeroboard",
    era: "2003",
    description: "2004, 목록만 남음",
  },
  WOWTrade: {
    id: "WOWTrade",
    nameKr: "WoW 장터",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
    description: "2004, 목록만 남음",
  },
  bod: {
    id: "bod",
    nameKr: "BOD 교환",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
    description: "UO 벌크 오더 디드(스미스·테일러) 교환 (2002), 목록만 남음",
  },

  // ── diary-skin BOD boards: the list page carries the whole post (02e) ──
  bod_b_s: {
    id: "bod_b_s",
    nameKr: "BOD 교환 — 발해 스미스",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
    description:
      "길드 발해의 스미스 벌크 오더 디드 교환란 (2002). 목록 페이지가 곧 글인 diary 스킨",
  },
  bod_b_t: {
    id: "bod_b_t",
    nameKr: "BOD 교환 — 발해 테일러",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
    description: "길드 발해의 테일러 벌크 오더 디드 교환란 (2002)",
  },
  bod_s_s: {
    id: "bod_s_s",
    nameKr: "BOD 교환 — 아리랑 스미스",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
    description:
      "길드 아리랑의 스미스 벌크 오더 디드 교환란 (2002). 캡처가 재생되지 않아 비어 있음",
  },
  bod_s_t: {
    id: "bod_s_t",
    nameKr: "BOD 교환 — 아리랑 테일러",
    category: "trade",
    engine: "zeroboard",
    era: "2003",
    description: "길드 아리랑의 테일러 벌크 오더 디드 교환란 (2002)",
  },
} as const satisfies Record<string, BoardMeta>;

export type BoardId = keyof typeof BOARDS;

/** Display order for board categories in sidebars and indexes. */
export const BOARD_CATEGORY_ORDER: readonly BoardCategory[] = [
  "uo",
  "community",
  "trade",
  "guide",
  "other",
] as const;

export function isBoardId(id: string): id is BoardId {
  return Object.hasOwn(BOARDS, id);
}

export function getBoard(id: string): BoardMeta | undefined {
  return isBoardId(id) ? BOARDS[id] : undefined;
}

export function getBoardOrThrow(id: string): BoardMeta {
  const board = getBoard(id);
  if (!board) {
    throw new Error(`Unknown board id: ${id}`);
  }
  return board;
}

export function listBoards(): readonly BoardMeta[] {
  return Object.values(BOARDS);
}

export function listBoardsByCategory(category: BoardCategory): readonly BoardMeta[] {
  return listBoards().filter((board) => board.category === category);
}
