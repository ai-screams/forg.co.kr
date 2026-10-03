/**
 * Museum landing — 2003 era home (Zeroboard frameset reproduction).
 *
 * Faithful structural reconstruction of `frame-{top,left,main,bottom}-2003.html`
 * captures (forg.co.kr Wayback 2003-06-03). The original site used a real
 * HTML4 `<frameset>` with 4 child frames; we emulate the same visual
 * layout with modern CSS flex/grid because framesets are deprecated and
 * incompatible with React + Next.js static export.
 *
 * Layout (mirrors the Wayback render visible in `.docs/research/
 * era-screenshots/`):
 *
 *   ┌── frame-top ─────────────────────────────────────────────────────┐
 *   │  [forg-logo]                                  (clock) Login│Sign Up │
 *   │  Free Board · Question?! · UO.Roleplay · UO.Essay ·               │
 *   │  HouseInterior · ScreenShot · Kal Ort Por · (?)                   │
 *   ├──────────────┬──────────────────────┬────────────────────────────┤
 *   │ Information  │ "We Created World."  │  FreeBoard                 │
 *   │ -지침서      │  game artwork        │  · post …                  │
 *   │ -게시판      │                      │  UO.Roleplay               │
 *   │ ...          │ NOTICE - UO          │  · post …                  │
 *   │ Cooperation  │ · post                │  UO.Essay                  │
 *   │ -벤더광고란  │  Roleplay & Events    │  · post …                  │
 *   │ ...          │ · post                │  BestScreenShot            │
 *   │ Reminisce    │  Online News          │  [thumbnail]               │
 *   │ Forg.Board   │ · post                │                            │
 *   │ Friend Site  │                       │                            │
 *   ├──────────────┴──────────────────────┴────────────────────────────┤
 *   │  Copyright 1999-2002 Forg.                                        │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * Chrome assets come from `public/img/chrome/` (Wayback-recovered in P2.4).
 * Most section headers (`m_*.gif`, `r_*.gif`) and menu buttons
 * (`t_b_*.gif`, `t_hi.gif`) are present. Missing decorative assets
 * (`m_middle_logo.gif`, `r_logo_1.gif`, `forg_main_logo_1.gif`) fall back
 * to typography so the layout never breaks.
 */

import { MobileMenu, ScrollFade } from "@/components/era-chrome-2014";
import Link from "@/components/link";

import type { BoardId } from "@/lib/boards";
import { chromeUrl } from "@/lib/chrome";
import type { Era } from "@/lib/era";
import { getRecentPostEntries } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

/** Every asset on this surface is asked for at its 2003 capture. Without it
 *  the newest capture wins and the exhibit wears 2007 artwork — see
 *  `lib/chrome`. */
const ERA: Era = "2003";

/** Visitor total shown by frame-bottom-2003 on 2003-06-03. Frozen, like
 *  the 2014 counter's 52,916,713. */
const VISITORS_2003 = 3399428;

const BOX_RECENT_COUNT = 6;

interface BoardBoxConfig {
  /** Board id matching `src/lib/boards.ts`. Drives the data fetch. */
  id: BoardId;
  /** Korean label used as accessible name (alt fallback). */
  label: string;
  /** Chrome asset filename in `public/img/chrome/`. */
  asset: string;
  /** Row bullet. frame-main-2003 used a.gif down the 350px column and a
   *  different arrow per box in the 185px one. */
  bullet: string;
}

// Left content column — m_* assets in the original frame-main-2003.
const LEFT_BOXES: BoardBoxConfig[] = [
  { id: "Notice", label: "NOTICE - ULTIMA ONLINE", asset: "m_notice.gif", bullet: "a.gif" },
  { id: "Role", label: "ROLEPLAY & EVENTS", asset: "m_role.gif", bullet: "a.gif" },
  { id: "column", label: "ONLINE NEWS", asset: "m_column.gif", bullet: "a.gif" },
];

// Right content column — r_* assets in the original.
const RIGHT_BOXES: BoardBoxConfig[] = [
  { id: "UoBoard", label: "FreeBoard", asset: "r_freeboard.gif", bullet: "menu_arrow.gif" },
  { id: "Role", label: "UO.Roleplay", asset: "r_role.gif", bullet: "menu_arrow_1.gif" },
  { id: "UOForum", label: "UO.Essay", asset: "r_essay.gif", bullet: "menu_arrow_2.gif" },
];

// Top 7-button menu (frame-top-2003.html) — 80×20 each + 20×20 FAQ icon.
interface TopMenuConfig {
  id: BoardId;
  asset: string;
  label: string;
}
const TOP_MENU_2003: TopMenuConfig[] = [
  { id: "UoBoard", asset: "t_b_freeboard.gif", label: "자유게시판" },
  { id: "Q_A", asset: "t_b_question.gif", label: "질답란" },
  { id: "Role", asset: "t_b_roleplay.gif", label: "롤플레이게시판" },
  { id: "UOForum", asset: "t_b_essay.gif", label: "울온에세이란" },
  { id: "HouseScreenshot", asset: "t_hi.gif", label: "하우스인테리어란" },
  { id: "ScreenShot", asset: "t_b_screenshot.gif", label: "스크린샷란" },
  // frame-top-2003 wires t_b_kal.gif to `zboard.php?id=Recall`. The 2003
  // art reads "Kal Ort Por" — the Ultima recall spell, which is the joke
  // the board name is making. (The 2007 capture of the same filename reads
  // "Hot Link"; that is a later redesign, not this era.)
  { id: "Recall", asset: "t_b_kal.gif", label: "Kal Ort Por" },
];

// Sidebar (frame-left-2003) — 5 sections with English chrome-bar
// headers and Korean dash-prefixed link rows. Hrefs follow the original
// frame; the guide pages it opened are `/site/…` documents (ETL Stage 2g).
// The guild directory was a popup (`/_zb/guild/index.html`), now a `/site/`
// page. The vendor popup (`/_zb/vendor/list.php`) has only a redirect
// capture, so that entry keeps the Vendor board. The cartoon lived on
// another host (`hosting27.interpia98.net/~forg/lomo/`), now `/site/lomo/`.
// The bulk-deed page survives only as its redirect to the FAQ, which
// `/site/bod/bod/` repeats; the poll is `/_zb/kritz_vote/`.
const SIDEBAR_SECTIONS: {
  /** Section header asset (English-titled GIF in chrome dir). */
  asset: string;
  /** Plain-text fallback when the asset can't load. */
  fallback: string;
  links: { label: string; href: string }[];
}[] = [
  {
    asset: "m_info.gif",
    fallback: "Information",
    links: [
      { label: "-초보자지침서", href: "/site/skill/uo_newbie/" },
      { label: "-초보자게시판", href: "/Newbie" },
      { label: "-쿠폰,시디구입처", href: "/site/skill/uoco/" },
      { label: "-울온전투기술", href: "/site/skill/uo_combat/" },
      { label: "-울온협력기술", href: "/site/skill/uo_veteran/" },
      { label: "-울온직업기술", href: "/site/skill/uo_jobs/" },
      { label: "-각종유용한정보", href: "/site/skill_knowhow/uo_knowhow/" },
      { label: "-UO.퀘스트정보", href: "/site/uoquest/Ant_Quest/" },
      { label: "-몬스터&던전란", href: "/site/dungeon/monster/" },
      { label: "-울온지도란", href: "/site/map/britian/" },
    ],
  },
  {
    asset: "m_co.gif",
    fallback: "Cooperation",
    links: [
      { label: "-벤더광고란", href: "/Vendor" },
      { label: "-아리랑장터란", href: "/Tarirang" },
      { label: "-발해장터란", href: "/Tbalhae" },
      { label: "-길드정보란", href: "/site/_zb/guild/index/" },
      { label: "-벌크디드정보란", href: "/site/bod/bod/" },
    ],
  },
  {
    asset: "m_remember.gif",
    fallback: "Reminisce",
    links: [
      { label: "-UO.만화", href: "/site/lomo/index/" },
      { label: "-UO.여행기", href: "/site/spotlight/spot_130/" },
      { label: "-인테리어정보", href: "/site/decoration/deco/" },
      { label: "-아이템스샷란", href: "/Items" },
    ],
  },
  {
    asset: "m_forg.gif",
    fallback: "Forg.Board",
    links: [
      { label: "-공동작업란", href: "/monster" },
      { label: "-포토갤러리", href: "/porato" },
      { label: "-휴지통게시판", href: "/Trash" },
      { label: "-유머게시판", href: "/FunBoard" },
      { label: "-Forg.멤버란", href: "/" },
      { label: "-울온설문조사란", href: "/site/_zb/kritz_vote/index/" },
    ],
  },
  {
    asset: "m_friend.gif",
    fallback: "Friend Site",
    links: [
      { label: "SiteMap", href: "/site/skill/sitemap/" },
      { label: "EA Korea", href: "https://www.ea.com" },
    ],
  },
];

interface BoxData {
  config: BoardBoxConfig;
  entries: BoardIndexEntry[];
  totalPosts: number | null;
}

async function loadBox(config: BoardBoxConfig): Promise<BoxData> {
  // Openable posts only; title-only rows (ADR-0017 §4) stay in the listing.
  // `getRecentPostEntries` walks past a page of them: ScreenShot and UOForum
  // both open on 50 list-page rows and would otherwise show an empty box.
  const recent = await getRecentPostEntries(config.id, BOX_RECENT_COUNT);
  if (!recent) {
    return { config, entries: [], totalPosts: null };
  }
  return { config, entries: recent.entries, totalPosts: recent.totalPosts };
}

/**
 * The 2003 exhibit itself — what goes in the 680px column. The frame
 * around it (header, sidebar, bottom strip) is shared with every other
 * route through `<EraShell>`, which imports the three Frame* components
 * exported below.
 */
export async function Home2003Content() {
  const [leftBoxes, rightBoxes] = await Promise.all([
    Promise.all(LEFT_BOXES.map(loadBox)),
    Promise.all(RIGHT_BOXES.map(loadBox)),
  ]);

  return <FrameMain2003 leftBoxes={leftBoxes} rightBoxes={rightBoxes} />;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: top — forg logo + small login/signup links + 7-button menu     */
/* ────────────────────────────────────────────────────────────────────── */
export function FrameTop2003() {
  // frame-top-2003: `<table width="680">` with `<td width="100" height="37"
  // rowspan="3">` holding left_logo.gif (100×42 — the 2003 logo, distinct
  // from 2014's left_logo1.gif), then three 580px rows: the #FFC73B login
  // bar, a 4px t_bar.gif rule and the menu row of 80×20 buttons. 18+4+20
  // equals the logo height, so the art spans all three rows.
  const leftLogo = chromeUrl("left_logo.gif", ERA);
  const tBarUrl = chromeUrl("t_bar.gif", ERA);
  const tLineUrl = chromeUrl("t_line.gif", ERA);

  return (
    <header>
      {/* `minmax(0,1fr)` + a scrolling menu row: see era-chrome-2014's header. */}
      <div className="grid grid-cols-[100px_minmax(0,1fr)] items-stretch">
        <Link
          href="/"
          aria-label="forg.co.kr 메인"
          className="row-span-3 flex items-start justify-start"
        >
          {leftLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export, recovered chrome
            <img
              loading="lazy"
              src={leftLogo}
              alt="Forg's World"
              width={100}
              height={42}
              className="block"
            />
          ) : (
            <span className="text-forg-ink block px-1 font-mono text-base leading-tight font-bold">
              forg<span className="text-forg-ink/70">&apos;s World</span>
            </span>
          )}
        </Link>

        <div className="bg-forg-gold flex h-[18px] items-center justify-end gap-[2px] px-2">
          <InertChrome2003 asset="t_login.gif" label="Login" title="박물관 모드 — 로그인 비활성" />
          <InertChrome2003
            asset="t_sign.gif"
            label="Sign Up"
            title="박물관 모드 — 회원가입 비활성"
          />
        </div>

        <div
          className="bg-forg-gold h-[4px] w-full"
          style={
            tBarUrl
              ? { backgroundImage: `url(${tBarUrl})`, backgroundRepeat: "repeat-x" }
              : undefined
          }
        />

        <div className="relative min-w-0">
          <nav
            aria-label="2003 상단 메뉴"
            className="bg-forg-menu flex h-[20px] items-center overflow-x-auto overflow-y-hidden [contain:paint] [scrollbar-width:none]"
          >
            {TOP_MENU_2003.map((item) => (
              <TopMenuButton2003 key={item.id} item={item} />
            ))}
            <span className="grow" />
            <FaqIcon2003 />
          </nav>
          <ScrollFade />
        </div>
      </div>
      <MobileMenu label="사이드바">
        {SIDEBAR_SECTIONS.map((section) => (
          <div key={section.fallback} className="col-span-2 mt-1">
            <p className="text-forg-gold-hover mb-[2px] text-[11px] font-bold tracking-wide">
              {section.fallback}
            </p>
            <div className="grid grid-cols-2 gap-x-4">
              {section.links.map((link) => (
                <Link key={link.label} href={link.href} className="block py-[5px]">
                  {link.label.replace(/^-/, "")}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </MobileMenu>
      {/* `<td width="680" height="12" background=t_line.gif bgcolor="#F1F1F2">` */}
      <div
        aria-hidden
        className="bg-forg-menu h-[12px] w-full"
        style={
          tLineUrl
            ? { backgroundImage: `url(${tLineUrl})`, backgroundRepeat: "repeat-x" }
            : undefined
        }
      />
    </header>
  );
}

/** Recovered 2003 chrome button the museum leaves inert. */
function InertChrome2003({ asset, label, title }: { asset: string; label: string; title: string }) {
  const url = chromeUrl(asset, ERA);
  if (!url) {
    return (
      <span title={title} className="text-forg-ink text-[10px] font-bold select-none">
        {label}
      </span>
    );
  }
  return (
    // 70×18 here, not the 2014 header's 70×15: the 2003 art is taller and
    // frame-top-2003 declares it that way.
    // eslint-disable-next-line @next/next/no-img-element -- static export, recovered chrome
    <img
      loading="lazy"
      src={url}
      alt={label}
      title={title}
      width={70}
      height={18}
      className="block"
    />
  );
}

function TopMenuButton2003({ item }: { item: TopMenuConfig }) {
  const assetUrl = chromeUrl(item.asset, ERA);
  if (assetUrl) {
    return (
      <Link
        href={`/${item.id}`}
        className="hover:bg-forg-gold/15 inline-block shrink-0"
        title={item.label}
      >
        {/* `mix-blend-mode: multiply` turns the GIF's opaque white background
           into the chrome bar's gray (white × gray = gray), so the buttons
           blend instead of floating as white tiles. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
        <img
          loading="lazy"
          src={assetUrl}
          alt={item.label}
          width={80}
          height={20}
          className="block h-[20px] w-[80px]"
        />
        <span className="sr-only">{item.label}</span>
      </Link>
    );
  }
  return (
    <Link
      href={`/${item.id}`}
      className="border-forg-gold/40 hover:bg-forg-gold/20 inline-block h-[20px] w-[80px] shrink-0 border-b-2 bg-white px-1 text-[10px] leading-[16px] font-bold"
    >
      {item.label}
    </Link>
  );
}

function FaqIcon2003() {
  const url = chromeUrl("t_b_right.gif", ERA);
  if (!url) return null;
  return (
    <span
      aria-label="Site FAQ (박물관 모드, 비활성)"
      title="Site FAQ"
      className="inline-block shrink-0 opacity-80"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
      <img
        loading="lazy"
        src={url}
        alt="Site FAQ"
        width={20}
        height={20}
        className="block h-[20px] w-[20px]"
      />
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: left — Information / Cooperation / Reminisce / Forg.Board ...  */
/* ────────────────────────────────────────────────────────────────────── */
export function FrameLeft2003() {
  // frameset cols="10, 100, 680, 7, 1*" and left_background.gif is 100×45.
  const tileUrl = chromeUrl("left_background.gif", ERA);
  return (
    <aside
      aria-label="2003 사이드바 — Information · Cooperation · Reminisce · Forg.Board · Friend Site"
      className="hidden w-[100px] shrink-0 bg-(--era-sidebar-bg) py-2 pl-[3px] text-(--era-sidebar-fg) min-[800px]:block"
      style={
        tileUrl ? { backgroundImage: `url(${tileUrl})`, backgroundRepeat: "repeat" } : undefined
      }
    >
      <nav className="flex flex-col gap-2.5">
        {SIDEBAR_SECTIONS.map((section) => (
          <SidebarSection2003 key={section.fallback} section={section} />
        ))}
        {/* Footer-of-sidebar links from frame-left-2003 (Login?(SP2), EA Korea) */}
        <div className="mt-1 space-y-0.5 border-t border-white/15 pt-2 text-[10px]">
          <p className="text-forg-gold-hover font-bold opacity-80">Login?(SP2)</p>
          <Link
            href="https://www.ea.com"
            rel="noopener noreferrer external"
            target="_blank"
            className="hover:text-forg-gold-hover block text-white"
          >
            EA Korea
          </Link>
        </div>
      </nav>
    </aside>
  );
}

function SidebarSection2003({ section }: { section: (typeof SIDEBAR_SECTIONS)[number] }) {
  const headerUrl = chromeUrl(section.asset, ERA);
  return (
    <div>
      {headerUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export
        <img
          loading="lazy"
          src={headerUrl}
          alt={section.fallback}
          width={100}
          height={25}
          className="mb-1 block h-[25px] w-[100px]"
        />
      ) : (
        <h3 className="text-forg-gold-hover mb-1 text-[11px] font-bold tracking-wide uppercase">
          {section.fallback}
        </h3>
      )}
      <ul className="space-y-[1px] pl-1">
        {section.links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="hover:text-forg-gold-hover block text-[10.5px] leading-tight text-white/85"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: main — 3-column content (left m_*, right r_*, no decoration)   */
/* ────────────────────────────────────────────────────────────────────── */
function FrameMain2003({ leftBoxes, rightBoxes }: { leftBoxes: BoxData[]; rightBoxes: BoxData[] }) {
  // frame-main-2003: `<table width="645" align="center">` with four columns —
  // 350 (boxes, background m_bar.gif) / 30 (m_middle_logo.gif, unrecovered) /
  // 185 (boxes, background r_bar.gif) / 80 (r_logo_1.gif, unrecovered).
  // The two decorative columns stay empty rather than hold a stand-in.
  const mBar = chromeUrl("m_bar.gif", ERA);
  const rBar = chromeUrl("r_bar.gif", ERA);
  const mBarLogo = chromeUrl("m_bar_logo.gif", ERA);
  // The two decorative columns. Both were served from
  // hosting27.interpia98.net in 2003, which is why the forg.co.kr-only
  // recovery never found them.
  const middleLogo = chromeUrl("m_middle_logo.gif", ERA);
  const rBarB = chromeUrl("r_bar_b.gif", ERA);
  const logoBottom = chromeUrl("logo_bottom.gif", ERA);
  // Neither of these had a capture on the interpia host, but the
  // forg.co.kr/images/ copies are in .docs/research/cdx/site-images.json —
  // an inventory that had never been joined against anything. Fetched
  // straight from those rows (2004-09-19 and 2004-02-22).
  const mainArt = chromeUrl("forg_main_logo_1.gif", ERA);
  const rightArt = chromeUrl("r_logo_1.gif", ERA);

  return (
    <section aria-label="2003 메인 콘텐츠" className="flex flex-1 flex-col bg-white px-3 py-2">
      <MainHeading />
      <div className="mx-auto grid w-full max-w-[645px] grid-cols-1 md:grid-cols-[350px_30px_185px_80px]">
        <div
          className="space-y-2"
          style={
            mBar ? { backgroundImage: `url(${mBar})`, backgroundRepeat: "repeat-y" } : undefined
          }
        >
          {mainArt && (
            // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 350×127 art
            <img
              loading="lazy"
              src={mainArt}
              alt="Ultima Online — Honor & Sacrifice"
              width={350}
              height={127}
              className="block max-md:h-auto max-md:w-full"
            />
          )}
          {leftBoxes.map((box) => (
            <SectionBox2003 key={box.config.asset} box={box} />
          ))}
        </div>
        <div aria-hidden className="hidden md:block">
          {middleLogo && (
            // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 30×520 chrome
            <img loading="lazy" src={middleLogo} alt="" width={30} height={520} className="block" />
          )}
        </div>
        <div
          className="space-y-2"
          style={
            rBar ? { backgroundImage: `url(${rBar})`, backgroundRepeat: "repeat-y" } : undefined
          }
        >
          {rightBoxes.map((box) => (
            <SectionBox2003 key={box.config.asset} box={box} compact />
          ))}
          <BestScreenShotBox />
        </div>
        <div aria-hidden className="hidden md:block">
          {rightArt && (
            // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 80×520 art
            <img loading="lazy" src={rightArt} alt="" width={80} height={520} className="block" />
          )}
        </div>
      </div>
      {/* Closing rule row: m_bar_logo.gif 350×20 over the 350px column, the
          rest `bgcolor="#5A6269"`. */}
      <div className="mx-auto mt-2 grid w-full max-w-[645px] grid-cols-1 md:grid-cols-[350px_30px_185px_80px]">
        {mBarLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export, recovered chrome
          <img loading="lazy" src={mBarLogo} alt="" width={350} height={20} className="block" />
        ) : (
          <div className="h-[20px]" />
        )}
        <div aria-hidden className="hidden h-[20px] bg-(--era-footer-bg) md:block" />
        <div aria-hidden className="hidden h-[20px] bg-(--era-footer-bg) md:block">
          {rBarB && (
            // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 185×1 rule
            <img loading="lazy" src={rBarB} alt="" width={185} height={1} className="block" />
          )}
        </div>
        <div aria-hidden className="hidden h-[20px] bg-(--era-footer-bg) md:block" />
      </div>
      {/* frame-main-2003 ends with logo_bottom.gif, a 380×18 "All Contents
          Copyright 1999-2002 Forg, All Rights Reserved." centred under the
          table. */}
      {logoBottom && (
        <p className="mt-2 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, recovered 380×18 chrome */}
          <img
            loading="lazy"
            src={logoBottom}
            alt="All Contents Copyright 1999-2002 Forg, All Rights Reserved."
            width={380}
            height={18}
          />
        </p>
      )}
    </section>
  );
}

function MainHeading() {
  return (
    <div className="border-b border-(--era-input-border) pb-1">
      <p className="text-[11px] font-bold">
        <span className="text-forg-ink">We Created World.</span>{" "}
        <span className="text-forg-muted">Origin System Inc.</span>
      </p>
    </div>
  );
}

/** The solid colour each header art ends in (every row of its last columns),
 *  used to carry the bar across a phone-wide box: 350px m_*.gif, 185px r_*.gif. */
const HEADER_TAIL: Record<string, string> = { m: "max-md:bg-[#c0c9cb]", r: "max-md:bg-[#e6e6e6]" };

function SectionBox2003({ box, compact = false }: { box: BoxData; compact?: boolean }) {
  const headerUrl = chromeUrl(box.config.asset, ERA);
  const bulletUrl = chromeUrl(box.config.bullet, ERA);
  const tail = HEADER_TAIL[box.config.asset.charAt(0)] ?? "";
  return (
    <section
      className="border-forg-gold/40 border-b bg-white max-md:mb-2"
      aria-label={box.config.label}
    >
      <Link
        href={`/${box.config.id}`}
        className={`bg-forg-gold/10 hover:bg-forg-gold/20 flex h-[22px] items-center px-1 ${tail}`}
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
          <span className="text-forg-ink text-[11px] font-bold">{box.config.label}</span>
        )}
        {headerUrl && <span className="sr-only">{box.config.label}</span>}
      </Link>
      <ul className="px-1 py-1.5 max-md:px-2">
        {box.totalPosts === null ? (
          <li className="text-forg-muted py-1 text-[10.5px] italic">준비 중</li>
        ) : box.entries.length === 0 ? (
          <li className="text-forg-muted py-1 text-[10.5px] italic">아직 게시글이 없습니다.</li>
        ) : (
          box.entries.slice(0, compact ? 5 : BOX_RECENT_COUNT).map((entry) => (
            <li key={entry.postId}>
              <Link
                href={`/${box.config.id}/${entry.postId}`}
                className="hover:text-forg-gold-hover block truncate text-[10.5px] leading-[1.45] text-(--era-link) max-md:border-b max-md:border-dotted max-md:border-[#e3e3e3] max-md:py-[6px] max-md:text-[14px]"
              >
                {bulletUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- static export, recovered bullet
                  <img
                    loading="lazy"
                    src={bulletUrl}
                    alt=""
                    width={compact ? 10 : 5}
                    height={15}
                    className="mr-[2px] inline-block align-[-3px]"
                  />
                )}
                {/* The 185px column had no room for a date and carried none. */}
                {!compact && (
                  <span className="text-forg-muted mr-1.5 font-mono text-[9px] max-md:text-[11px]">
                    {monthDayFromIso(entry.createdAt)}
                  </span>
                )}
                {entry.title}
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function BestScreenShotBox() {
  // Both assets are the originals, recovered 2026-09-18: r_screen.gif is the
  // 185×22 header and best_22.gif the 160×105 thumbnail the 2003 front page
  // actually carried. Earlier code substituted r_essay.gif here, which made
  // the page claim this box was UO.Essay.
  //
  // The 2003 art reads "BestScreenShot"; the later capture of the same
  // filename reads "Last Expansion Pack", which is what we shipped until the
  // era pools existed. frame-main-2003 wires both header and thumbnail to the
  // ScreenShot board. The original served the header from
  // hosting27.interpia98.net/~forg/images/.
  const headerUrl = chromeUrl("r_screen.gif", ERA);
  const shotUrl = chromeUrl("best_22.gif", ERA);
  return (
    <section className="border-forg-gold/40 border-b bg-white" aria-label="BestScreenShot">
      <div
        className="bg-forg-gold/10 flex h-[22px] items-center px-1 max-md:bg-[#e6e6e6]"
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
        {!headerUrl && <span className="text-forg-ink text-[11px] font-bold">BestScreenShot</span>}
        <span className="sr-only">BestScreenShot</span>
      </div>
      {shotUrl ? (
        // The original deep-linked ScreenShot post no=7755, which is above the
        // highest id Wayback archived for that board (6212), so the link goes
        // to the board itself.
        <Link href="/ScreenShot" className="flex justify-center py-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- static export, recovered chrome */}
          <img loading="lazy" src={shotUrl} alt="2003년 베스트 스크린샷" width={160} height={105} />
        </Link>
      ) : (
        <div className="text-forg-muted flex h-[80px] items-center justify-center text-[10px] italic">
          스크린샷 박물관 준비 중
        </div>
      )}
    </section>
  );
}

function monthDayFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return "—";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: bottom — copyright                                              */
/* ────────────────────────────────────────────────────────────────────── */
export function FrameBottom2003() {
  // frame-bottom-2003, 24px per the frameset's `rows="53, 80%, 24"`, on
  // `bgcolor="6B82A5"` with bgm/bgm_bg.gif tiled. Four cells: count.gif
  // ("Total :", 50px) · the visitor number (70px, #fafafa) · ser.gif
  // ("SEARCH") with a 150px text input and an en.gif submit · bgm_right.gif
  // right-aligned. The frame also started a Shoutcast stream on load
  // (`onload="cast()"`, mulple.com), which is the "bgm" in the filenames;
  // the museum keeps the counter and the search and drops the music.
  const bgUrl = chromeUrl("bgm_bg.gif", ERA);
  const countUrl = chromeUrl("count.gif", ERA);
  const serUrl = chromeUrl("bgm_ser.gif", ERA);
  const enUrl = chromeUrl("bgm_en.gif", ERA);
  const rightUrl = chromeUrl("bgm_right.gif", ERA);
  const tile = bgUrl
    ? { backgroundImage: `url(${bgUrl})`, backgroundRepeat: "repeat-x" }
    : undefined;

  return (
    <footer
      role="group"
      aria-label="누적 방문 (2003-06-03 기준 박제) · 검색"
      className="bg-forg-bgm text-forg-cream flex h-[24px] w-full shrink-0 items-center text-[11px]"
      style={tile}
    >
      <div className="flex h-[24px] w-[50px] shrink-0 items-end">
        {countUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 50×24 chrome
          <img
            loading="lazy"
            src={countUrl}
            alt="Total :"
            width={50}
            height={24}
            className="block"
          />
        ) : (
          <span className="pl-1 font-bold">Total :</span>
        )}
      </div>
      <span className="w-[70px] shrink-0 pt-[6px] font-mono text-[11px] tabular-nums">
        {VISITORS_2003}
      </span>
      <form action="/search" method="get" className="flex h-[24px] grow items-center gap-[4px]">
        {serUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 50×24 chrome
          <img loading="lazy" src={serUrl} alt="SEARCH" width={50} height={24} className="block" />
        ) : (
          <span className="font-bold">SEARCH</span>
        )}
        <input
          type="search"
          name="q"
          aria-label="검색어"
          placeholder="Forg's World"
          className="text-forg-ink h-[17px] w-[150px] border border-(--era-input-border) bg-(--era-content-bg) px-1 text-[12px]"
        />
        {enUrl ? (
          <button type="submit" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element -- static export, recovered chrome */}
            <img loading="lazy" src={enUrl} alt="ENTER" className="block" />
          </button>
        ) : (
          <button
            type="submit"
            className="text-forg-cream/90 h-[17px] border border-(--era-input-border) bg-(--era-page-bg)/30 px-1 text-[10px] font-bold"
          >
            ENTER
          </button>
        )}
      </form>
      {rightUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- static export, decorative 150×24 chrome
        <img
          loading="lazy"
          src={rightUrl}
          alt=""
          width={150}
          height={24}
          className="hidden h-[24px] w-auto shrink-0 sm:block"
        />
      )}
    </footer>
  );
}
