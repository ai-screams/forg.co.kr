/**
 * Museum landing — 2003 era home: what frame-main-2003 held (2003-06-03),
 * the "We Created World." artwork between the m_* and r_* board boxes.
 * The frames around it are `era-chrome-2003.tsx`; the layout diagram is
 * there.
 */

import Link from "@/components/link";

import { LazyImg } from "@/components/lazy-img";
import type { BoardId } from "@/lib/boards";
import { chromeUrl, tileStyle } from "@/lib/chrome";
import { formatMonthDay } from "@/lib/dates";
import type { Era } from "@/lib/era";
import { getRecentPostEntries } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

/** Every asset on this surface is asked for at its 2003 capture. Without it
 *  the newest capture wins and the exhibit wears 2007 artwork — see
 *  `lib/chrome`. */
const ERA: Era = "2003";

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

interface BoxData {
  config: BoardBoxConfig;
  entries: BoardIndexEntry[];
  totalPosts: number;
}

async function loadBox(config: BoardBoxConfig): Promise<BoxData> {
  // Openable posts only; title-only rows (ADR-0017 §4) stay in the listing.
  // `getRecentPostEntries` walks past a page of them: ScreenShot and UOForum
  // both open on 50 list-page rows and would otherwise show an empty box.
  const recent = await getRecentPostEntries(config.id, BOX_RECENT_COUNT);
  return { config, entries: recent.entries, totalPosts: recent.totalPosts };
}

/**
 * The 2003 exhibit itself — what goes in the 680px column. The frame
 * around it (header, sidebar, bottom strip) is shared with every other
 * route through `<EraShell>`, from `era-chrome-2003.tsx`.
 */
export async function Home2003Content() {
  const [leftBoxes, rightBoxes] = await Promise.all([
    Promise.all(LEFT_BOXES.map(loadBox)),
    Promise.all(RIGHT_BOXES.map(loadBox)),
  ]);

  return <FrameMain2003 leftBoxes={leftBoxes} rightBoxes={rightBoxes} />;
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
        <div className="space-y-2" style={tileStyle(mBar, "repeat-y")}>
          {mainArt && (
            <LazyImg
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
            <LazyImg src={middleLogo} alt="" width={30} height={520} className="block" />
          )}
        </div>
        <div className="space-y-2" style={tileStyle(rBar, "repeat-y")}>
          {rightBoxes.map((box) => (
            <SectionBox2003 key={box.config.asset} box={box} compact />
          ))}
          <BestScreenShotBox />
        </div>
        <div aria-hidden className="hidden md:block">
          {rightArt && <LazyImg src={rightArt} alt="" width={80} height={520} className="block" />}
        </div>
      </div>
      {/* Closing rule row: m_bar_logo.gif 350×20 over the 350px column, the
          rest `bgcolor="#5A6269"`. */}
      <div className="mx-auto mt-2 grid w-full max-w-[645px] grid-cols-1 md:grid-cols-[350px_30px_185px_80px]">
        {mBarLogo ? (
          <LazyImg src={mBarLogo} alt="" width={350} height={20} className="block" />
        ) : (
          <div className="h-[20px]" />
        )}
        <div aria-hidden className="hidden h-[20px] bg-(--era-footer-bg) md:block" />
        <div aria-hidden className="hidden h-[20px] bg-(--era-footer-bg) md:block">
          {rBarB && <LazyImg src={rBarB} alt="" width={185} height={1} className="block" />}
        </div>
        <div aria-hidden className="hidden h-[20px] bg-(--era-footer-bg) md:block" />
      </div>
      {/* frame-main-2003 ends with logo_bottom.gif, a 380×18 "All Contents
          Copyright 1999-2002 Forg, All Rights Reserved." centred under the
          table. */}
      {logoBottom && (
        <p className="mt-2 flex justify-center">
          <LazyImg
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
        style={tileStyle(headerUrl, "no-repeat", "left center")}
      >
        {!headerUrl && (
          <span className="text-forg-ink text-[11px] font-bold">{box.config.label}</span>
        )}
        {headerUrl && <span className="sr-only">{box.config.label}</span>}
      </Link>
      <ul className="px-1 py-1.5 max-md:px-2">
        {box.entries.slice(0, compact ? 5 : BOX_RECENT_COUNT).map((entry) => (
          <li key={entry.postId}>
            <Link
              href={`/${box.config.id}/${entry.postId}`}
              className="hover:text-forg-gold-hover block truncate text-[10.5px] leading-[1.45] text-(--era-link) max-md:border-b max-md:border-dotted max-md:border-[#e3e3e3] max-md:py-[6px] max-md:text-[14px]"
            >
              {bulletUrl && (
                <LazyImg
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
                  {formatMonthDay(entry.createdAt)}
                </span>
              )}
              {entry.title}
            </Link>
          </li>
        ))}
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
        style={tileStyle(headerUrl, "no-repeat", "left center")}
      >
        {!headerUrl && <span className="text-forg-ink text-[11px] font-bold">BestScreenShot</span>}
        <span className="sr-only">BestScreenShot</span>
      </div>
      {shotUrl ? (
        // The original deep-linked ScreenShot post no=7755, which is above the
        // highest id Wayback archived for that board (6212), so the link goes
        // to the board itself.
        <Link href="/ScreenShot" className="flex justify-center py-1">
          <LazyImg src={shotUrl} alt="2003년 베스트 스크린샷" width={160} height={105} />
        </Link>
      ) : (
        <div className="text-forg-muted flex h-[80px] items-center justify-center text-[10px] italic">
          스크린샷 박물관 준비 중
        </div>
      )}
    </section>
  );
}
