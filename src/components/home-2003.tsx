/**
 * Museum landing — 2003 era home (Zeroboard frameset reproduction).
 *
 * Faithful structural reconstruction of `frame-{top,left,main,bottom}-2003.html`
 * captures (forg.co.kr Wayback 2003-06-03). The original site used a real
 * HTML4 `<frameset>` with 4 child frames; we emulate the same visual
 * layout with modern CSS flex/grid because framesets are deprecated and
 * incompatible with React + Next.js static export.
 *
 *   ┌────────────────────────── frame-top (680, 100h) ──────────────────────────┐
 *   │  [forg-logo]  [login bar]   [signup]                                       │
 *   │                                                                            │
 *   │  자유 · 질답 · 영상 · 룰플 · 칼럼 · 스샷 · 트래시   (7-button menu)         │
 *   ├────────────────────┬───────────────────────────────────────────────────────┤
 *   │                    │                                                       │
 *   │  frame-left        │  frame-main (645w)                                    │
 *   │  (sidebar)         │                                                       │
 *   │                    │  m_notice    │   r_freeboard                          │
 *   │  - 초보자지침서    │  • post …    │   • post …                             │
 *   │  - 초보자게시판    │              │                                        │
 *   │  - 쿠폰/시디       │  m_role      │   r_role                               │
 *   │  - 울온전투기술    │  • post …    │   • post …                             │
 *   │  - 울온협력기술    │                                                       │
 *   │  - 울온직업기술    │  m_column    │   r_essay                              │
 *   │  - 각종유용정보    │  • post …    │   • post …                             │
 *   │  - UO.퀘스트정보   │                                                       │
 *   │                    │                                                       │
 *   ├────────────────────┴──────── frame-bottom (24h) ──────────────────────────┤
 *   │  visitor counter (frozen)                                                  │
 *   └────────────────────────────────────────────────────────────────────────────┘
 *
 * Chrome assets come from `public/img/chrome/` (Wayback-recovered in P2.4).
 * 22 of 29 required 2003 assets are already on disk from the 2014 recovery
 * pass; the 6 missing ones (`5px.gif`, `count.gif`, `left_logo.gif` etc.)
 * fall back to typography / OKLCH CSS so the layout never breaks.
 */

import Link from "next/link";

import type { BoardId } from "@/lib/boards";
import { chromeUrl } from "@/lib/chrome";
import { getBoardIndex } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

const BOX_RECENT_COUNT = 6;

interface BoardBoxConfig {
  /** Board id matching `src/lib/boards.ts`. Drives the data fetch. */
  id: BoardId;
  /** Korean section label used as fallback when the chrome GIF is missing. */
  label: string;
  /** Chrome asset filename in `public/img/chrome/`. */
  asset: string;
}

// Left column of the 2-column post-listing grid (m_* assets in the original).
const LEFT_BOXES: BoardBoxConfig[] = [
  { id: "Notice", label: "공지사항", asset: "m_notice.gif" },
  { id: "Role", label: "롤플레잉", asset: "m_role.gif" },
  { id: "column", label: "UO 컬럼", asset: "m_column.gif" },
];

// Right column (r_* assets in the original).
const RIGHT_BOXES: BoardBoxConfig[] = [
  { id: "UoBoard", label: "자유게시판", asset: "r_freeboard.gif" },
  { id: "Q_A", label: "질문/답변", asset: "r_role.gif" }, // r_role.gif is the closest available chrome
  { id: "UOForum", label: "에세이", asset: "r_essay.gif" },
  { id: "ScreenShot", label: "스크린샷", asset: "r_freeboard.gif" }, // fallback
];

// 2003-era top menu — Zeroboard frameset's 7-button bar across the top.
interface TopMenuConfig {
  id: BoardId;
  asset: string;
  label: string;
}
const TOP_MENU_2003: TopMenuConfig[] = [
  { id: "UoBoard", asset: "t_b_freeboard.gif", label: "자유게시판" },
  { id: "Q_A", asset: "t_b_question.gif", label: "질문답변" },
  { id: "Role", asset: "t_b_roleplay.gif", label: "롤플레잉" },
  { id: "Events", asset: "t_b_essay.gif", label: "이벤트" },
  { id: "ScreenShot", asset: "t_b_screenshot.gif", label: "스크린샷" },
  { id: "Items", asset: "t_b_kal.gif", label: "거래" },
  { id: "Trash", asset: "t_b_right.gif", label: "트래시" },
];

// 2003 sidebar nav — flat list of 8 sections matching frame-left-2003.html.
const SIDEBAR_SECTIONS: {
  header: string;
  asset: string;
  links: { label: string; href: string }[];
}[] = [
  {
    header: "초보 가이드",
    asset: "m_info.gif",
    links: [
      { label: "초보자 지침서", href: "/Notice" },
      { label: "초보자 게시판", href: "/Q_A" },
      { label: "쿠폰/시디 구입처", href: "/Items" },
    ],
  },
  {
    header: "UO 기술",
    asset: "m_co.gif",
    links: [
      { label: "울온 전투기술", href: "/Role" },
      { label: "울온 협력기술", href: "/Role" },
      { label: "울온 직업기술", href: "/Role" },
      { label: "각종 유용한 정보", href: "/column" },
    ],
  },
  {
    header: "퀘스트/이벤트",
    asset: "m_remember.gif",
    links: [
      { label: "UO 퀘스트 정보", href: "/Events" },
      { label: "이벤트 일정", href: "/Events" },
    ],
  },
  {
    header: "Forg 커뮤니티",
    asset: "m_forg.gif",
    links: [
      { label: "Forg 자유게시판", href: "/UoBoard" },
      { label: "Forg 칼럼", href: "/column" },
      { label: "Forg 포럼", href: "/UOForum" },
    ],
  },
  {
    header: "친구사이트",
    asset: "m_friend.gif",
    links: [
      { label: "포라토", href: "/porato" },
      { label: "타리랑섭", href: "/Tarirang" },
      { label: "트발해섭", href: "/Tbalhae" },
    ],
  },
];

interface BoxData {
  config: BoardBoxConfig;
  entries: BoardIndexEntry[];
  totalPosts: number | null;
}

async function loadBox(config: BoardBoxConfig): Promise<BoxData> {
  const index = await getBoardIndex(config.id, 1);
  if (!index) {
    return { config, entries: [], totalPosts: null };
  }
  return {
    config,
    entries: index.entries.slice(0, BOX_RECENT_COUNT),
    totalPosts: index.totalPosts,
  };
}

export async function Home2003() {
  const [leftBoxes, rightBoxes] = await Promise.all([
    Promise.all(LEFT_BOXES.map(loadBox)),
    Promise.all(RIGHT_BOXES.map(loadBox)),
  ]);

  return (
    <div className="flex w-full flex-1 justify-center bg-(--era-page-bg) py-4 font-[Verdana,'돋움',Dotum,sans-serif]">
      <div
        className="flex w-full max-w-[800px] flex-col gap-1 border border-(--era-input-border) bg-(--era-content-bg) shadow-md"
        style={{ fontFamily: "Verdana, '돋움', Dotum, sans-serif" }}
      >
        <FrameTop2003 />
        <div className="flex flex-1">
          <FrameLeft2003 />
          <FrameMain2003 leftBoxes={leftBoxes} rightBoxes={rightBoxes} />
        </div>
        <FrameBottom2003 />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: top — logo + login bar + 7-button menu                         */
/* ────────────────────────────────────────────────────────────────────── */
function FrameTop2003() {
  // Original used `left_logo.gif` (top-left forg logo) — not in our chrome
  // assets, fallback to typography.
  const tLogin = chromeUrl("t_login.gif");
  const tSign = chromeUrl("t_sign.gif");

  return (
    <header className="bg-(--era-content-bg) px-3 py-3">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-forg-ink font-bold tracking-tight"
          aria-label="forg.co.kr 메인"
        >
          <span className="font-mono text-lg">
            <span className="text-forg-gold-hover">forg</span>
            <span className="text-forg-muted">.co.kr</span>
          </span>
          <span className="text-forg-muted ml-3 text-[10px]">Welcome to Forg&apos;s World</span>
        </Link>
        <nav aria-label="로그인 / 가입 (박물관 모드, 비활성)" className="flex items-center gap-2">
          {tLogin ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export, ~3 KB GIF
            <img src={tLogin} alt="Welcome to Forg's World" width={120} height={20} />
          ) : (
            <span className="text-forg-muted bg-forg-gold/10 rounded px-2 py-1 text-[10px]">
              LOGIN (박물관)
            </span>
          )}
          {tSign ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export, ~3 KB GIF
            <img src={tSign} alt="Forg's Family" width={80} height={20} />
          ) : (
            <span className="text-forg-muted bg-forg-gold/10 rounded px-2 py-1 text-[10px]">
              SIGNUP
            </span>
          )}
        </nav>
      </div>

      {/* 7-button top menu (the iconic 2003 chrome bar) */}
      <nav
        aria-label="2003 상단 메뉴"
        className="mt-3 flex items-center justify-center gap-[2px] border-y border-(--era-input-border) bg-(--era-content-bg) py-1"
      >
        {TOP_MENU_2003.map((item) => (
          <TopMenuButton2003 key={item.id} item={item} />
        ))}
      </nav>
    </header>
  );
}

function TopMenuButton2003({ item }: { item: TopMenuConfig }) {
  const assetUrl = chromeUrl(item.asset);
  if (assetUrl) {
    return (
      <Link
        href={`/${item.id}`}
        className="group hover:bg-forg-gold/15 inline-block px-[1px]"
        title={item.label}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
        <img src={assetUrl} alt={item.label} width={80} height={20} className="block" />
        <span className="sr-only">{item.label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={`/${item.id}`}
      className="border-forg-gold/40 hover:bg-forg-gold/20 inline-block border-b-2 bg-white px-2 py-1 text-[10px] font-bold"
    >
      {item.label}
    </Link>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: left — nav sidebar                                              */
/* ────────────────────────────────────────────────────────────────────── */
function FrameLeft2003() {
  return (
    <aside
      aria-label="2003 사이드바 네비"
      className="hidden w-[150px] shrink-0 border-r border-(--era-input-border) bg-(--era-sidebar-bg) px-2 py-3 text-(--era-sidebar-fg) sm:block"
    >
      <nav className="flex flex-col gap-3 text-[11px]">
        {SIDEBAR_SECTIONS.map((section) => (
          <SidebarSection2003 key={section.header} section={section} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarSection2003({ section }: { section: (typeof SIDEBAR_SECTIONS)[number] }) {
  const headerUrl = chromeUrl(section.asset);
  return (
    <div>
      {headerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export
        <img src={headerUrl} alt={section.header} width={130} height={18} className="mb-1 block" />
      ) : (
        <h3 className="text-forg-ink mb-1 border-b border-(--era-input-border) pb-0.5 text-[11px] font-bold">
          {section.header}
        </h3>
      )}
      <ul className="ml-1 space-y-0.5">
        {section.links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="hover:text-forg-gold-hover text-[10.5px] leading-tight text-(--era-sidebar-fg)"
            >
              · {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: main — 2-column post-listing grid                               */
/* ────────────────────────────────────────────────────────────────────── */
function FrameMain2003({ leftBoxes, rightBoxes }: { leftBoxes: BoxData[]; rightBoxes: BoxData[] }) {
  return (
    <section
      aria-label="2003 메인 콘텐츠"
      className="flex flex-1 flex-col gap-2 bg-(--era-content-bg) px-3 py-3"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-3">
          {leftBoxes.map((box) => (
            <BoxCard2003 key={box.config.id} box={box} variant="left" />
          ))}
        </div>
        <div className="space-y-3">
          {rightBoxes.map((box) => (
            <BoxCard2003 key={box.config.id + box.config.asset} box={box} variant="right" />
          ))}
        </div>
      </div>
    </section>
  );
}

function BoxCard2003({ box, variant }: { box: BoxData; variant: "left" | "right" }) {
  const headerUrl = chromeUrl(box.config.asset);
  return (
    <section className="border-forg-gold/30 border-b" aria-label={box.config.label}>
      <Link
        href={`/${box.config.id}`}
        className="bg-forg-gold/10 hover:bg-forg-gold/20 block h-[22px] w-full overflow-hidden"
        style={
          headerUrl
            ? {
                backgroundImage: `url(${headerUrl})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "left center",
              }
            : undefined
        }
      >
        {!headerUrl && (
          <div className="flex h-full items-center justify-between px-2">
            <span className="text-forg-ink text-[11px] font-bold">{box.config.label}</span>
            <span className="text-forg-muted font-mono text-[9px] uppercase">
              {variant === "left" ? "←" : "→"} zeroboard
            </span>
          </div>
        )}
        {headerUrl && <span className="sr-only">{box.config.label}</span>}
      </Link>
      <ul className="bg-(--era-content-bg) p-2">
        {box.totalPosts === null ? (
          <li className="text-forg-muted py-1 text-[10.5px] italic">
            준비 중 (해당 보드 아직 미수집)
          </li>
        ) : box.entries.length === 0 ? (
          <li className="text-forg-muted py-1 text-[10.5px] italic">아직 게시글이 없습니다.</li>
        ) : (
          box.entries.map((entry) => (
            <li key={entry.postId}>
              <Link
                href={`/${box.config.id}/${entry.postId}`}
                className="hover:text-forg-gold-hover block truncate text-[10.5px] leading-[1.4] text-(--era-link)"
              >
                <span className="text-forg-muted mr-1.5 font-mono text-[9px]">
                  {monthDayFromIso(entry.createdAt)}
                </span>
                {entry.title}
                {entry.commentCount > 0 && (
                  <span className="text-forg-gold-hover ml-1 font-mono text-[9px] tabular-nums">
                    [{entry.commentCount}]
                  </span>
                )}
              </Link>
            </li>
          ))
        )}
        {box.totalPosts !== null && box.totalPosts > BOX_RECENT_COUNT && (
          <li className="mt-1 text-right">
            <Link
              href={`/${box.config.id}`}
              className="text-forg-muted hover:text-forg-gold-hover text-[9px]"
            >
              전체 {box.totalPosts.toLocaleString("ko-KR")}건 →
            </Link>
          </li>
        )}
      </ul>
    </section>
  );
}

function monthDayFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return "—";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: bottom — visitor counter                                        */
/* ────────────────────────────────────────────────────────────────────── */
const VISITORS_2003 = 12_543_217; // approximate 2003-era frozen visitor count

function FrameBottom2003() {
  return (
    <footer
      aria-label="2003 방문자 카운터 (박물관 박제)"
      className="border-t border-(--era-input-border) bg-(--era-content-bg) px-3 py-1 text-center text-[10px]"
    >
      <span className="text-forg-muted">방문자 </span>
      <strong className="text-forg-gold-hover font-mono tabular-nums">
        {VISITORS_2003.toLocaleString("ko-KR")}
      </strong>
      <span className="text-forg-muted"> · 2003 시기 박물관 박제 표기</span>
    </footer>
  );
}
