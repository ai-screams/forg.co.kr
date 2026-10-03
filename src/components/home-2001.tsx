/**
 * Museum landing — 2001 era home (ADR-0019).
 *
 * forg as it stood in August 2001, from the captures of its two frames
 * (`/site/forg_t/20010803093946/` and `/site/forg_b/20010803094010/`):
 *
 *   frameset cols="1*, 790, 1*"   left.htm │ forg_t (56) / forg_b │ right.htm
 *
 *   ┌── forg_t ─────────────────────────────────────────────────────────┐
 *   │ t_logo.gif (380×35)            t_logo_r.gif (410×35, copyright)    │
 *   │ t_l · 14 buttons of 55×20 (메인 … 자료실&울온여행) · t_r             │
 *   ├── forg_b: table 740, border #CCCCCC ──────────────────────────────┤
 *   │ 150: art 145×609 │ 390 (#FCFBE9): 390×200 art,  │ 200: FreeBoard    │
 *   │  NeverEnding     │  Notice  (8 rows, date)      │      Question?!   │
 *   │  Forg.Members    │  Roleplaying and Events (8)  │      UO.Essay     │
 *   │  UO.Poll         │                              │      ScreenShot   │
 *   └──────────────────┴──────────────────────────────┴──────────────────┘
 *
 * The side frames' background (`forg_1.gif`) and the top frame's
 * (`t_line.gif`) were never captured; the UO.Essay and ScreenShot headers
 * (`uoessay.gif`, `screen.gif`) neither, so those two are text. The frames
 * held a snapshot of each board's newest titles; the museum fills the same
 * slots from its own boards, as the 2003 home does.
 */

import Link from "@/components/link";

import type { BoardId } from "@/lib/boards";
import { chromeUrl, type ChromeEra } from "@/lib/chrome";
import { getRecentPostEntries } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

const ERA: ChromeEra = "2001";

// forg_t's menu row, left to right, with the alt text each button had.
const TOP_MENU_2001: { asset: string; label: string; href: string }[] = [
  { asset: "m_m.gif", label: ":::메인:::", href: "/" },
  { asset: "m_n.gif", label: "초보자Guide", href: "/site/skill/uo_newbie/" },
  { asset: "m_c.gif", label: "전투스킬", href: "/site/skill/uo_combat/" },
  { asset: "m_j.gif", label: "직업스킬", href: "/site/skill/uo_jobs/" },
  { asset: "m_t.gif", label: "울온관련팁", href: "/site/skill/uo_knowhow/" },
  { asset: "m_map.gif", label: "울온지도", href: "/site/map/" },
  { asset: "m_f.gif", label: "자유게시판", href: "/UoBoard" },
  { asset: "m_q.gif", label: "질문란", href: "/Q_A" },
  { asset: "m_r.gif", label: "울온여행기", href: "/Role" },
  { asset: "m_e.gif", label: "Essay", href: "/UOForum" },
  { asset: "m_b.gif", label: "장터란", href: "/Sell" },
  { asset: "m_fun.gif", label: "유머게시판", href: "/FunBoard" },
  { asset: "m_s.gif", label: "스크린샷&벤더광고란", href: "/ScreenShot" },
  { asset: "m_k.gif", label: "자료실&울온여행", href: "/Recall" },
];

interface Box2001 {
  id: BoardId;
  label: string;
  /** Header art, or null where it was never captured (drawn as text). */
  asset: string | null;
  width: number;
  height: number;
  count: number;
  dated: boolean;
}

const MIDDLE_BOXES: Box2001[] = [
  {
    id: "Notice",
    label: "Notice",
    asset: "main_notice.gif",
    width: 390,
    height: 29,
    count: 8,
    dated: true,
  },
  {
    id: "Events",
    label: "Roleplaying and Events",
    asset: "main_notice_1.gif",
    width: 390,
    height: 30,
    count: 8,
    dated: true,
  },
];

const RIGHT_BOXES: Box2001[] = [
  {
    id: "UoBoard",
    label: "FreeBoard",
    asset: "freeboard.gif",
    width: 200,
    height: 30,
    count: 5,
    dated: false,
  },
  {
    id: "Q_A",
    label: "Question?!",
    asset: "question.gif",
    width: 200,
    height: 30,
    count: 5,
    dated: false,
  },
  { id: "UOForum", label: "UO.Essay", asset: null, width: 200, height: 30, count: 5, dated: false },
];

// left_logo_uo_1.gif's image map. RollMembers and the member list have no
// museum page, so they open their 2001 captures, as the ETL resolves them.
const LEFT_MAP: { coords: string; label: string; href: string }[] = [
  {
    coords: "21,93,94,116",
    label: "NeverEnding Story",
    href: "https://web.archive.org/web/20010803094010/http://forg.co.kr/zboard/zboard.php?id=RollMembers",
  },
  {
    coords: "49,171,130,186",
    label: "Forg.Members",
    href: "https://web.archive.org/web/20010803094010/http://forg.co.kr/zboard/linuz_member.php?category=8&id=member&status=&keyword=&arrange=no&desc=desc",
  },
  { coords: "76,239,124,254", label: "UO.Poll", href: "/site/zboard/zboard--id-UO_Vote/" },
  {
    coords: "31,554,130,578",
    label: "We create worlds. Origin System Inc.",
    href: "https://web.archive.org/web/2001/http://www.kr.uo.com/",
  },
];

interface BoxData {
  box: Box2001;
  entries: BoardIndexEntry[];
}

async function loadBox(box: Box2001): Promise<BoxData> {
  const recent = await getRecentPostEntries(box.id, box.count);
  return { box, entries: recent?.entries ?? [] };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: top — banner and the 14-button menu (forg_t.htm)               */
/* ────────────────────────────────────────────────────────────────────── */
export function FrameTop2001() {
  const logo = chromeUrl("t_logo.gif", ERA);
  const logoRight = chromeUrl("t_logo_r.gif", ERA);
  const left = chromeUrl("t_l.gif", ERA);
  const right = chromeUrl("t_r.gif", ERA);
  return (
    <header className="bg-white">
      <div className="flex bg-[#f8f8f8] max-[799px]:flex-col">
        <Link href="/" aria-label="forg.co.kr 메인" className="block">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 380×35 banner
            <img
              loading="lazy"
              src={logo}
              alt="Ultima Online of Forg"
              width={380}
              height={35}
              className="block max-w-full"
            />
          )}
        </Link>
        {logoRight && (
          // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 410×35 banner
          <img
            loading="lazy"
            src={logoRight}
            alt="All Contents Copyright(C) 1999. FORG.COM. All right reserved."
            width={410}
            height={35}
            className="block max-w-full max-[799px]:hidden"
          />
        )}
      </div>
      <nav aria-label="2001 상단 메뉴" className="flex flex-wrap bg-[#f8f8f8]">
        {left && (
          // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 10×20 cap
          <img
            loading="lazy"
            src={left}
            alt=""
            width={10}
            height={20}
            className="block max-[799px]:hidden"
          />
        )}
        {TOP_MENU_2001.map((item) => {
          const url = chromeUrl(item.asset, ERA);
          const inner = url ? (
            // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 55×20 button
            <img
              loading="lazy"
              src={url}
              alt={item.label}
              title={item.label}
              width={55}
              height={20}
              className="block"
            />
          ) : (
            <span className="block h-[20px] w-[55px] text-center text-[10px] leading-[20px]">
              {item.label}
            </span>
          );
          return item.href.startsWith("/site/") ? (
            <a key={item.asset} href={item.href}>
              {inner}
            </a>
          ) : (
            <Link key={item.asset} href={item.href}>
              {inner}
            </Link>
          );
        })}
        {right && (
          // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 10×20 cap
          <img
            loading="lazy"
            src={right}
            alt=""
            width={10}
            height={20}
            className="block max-[799px]:hidden"
          />
        )}
      </nav>
    </header>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: forg_b — the front page                                         */
/* ────────────────────────────────────────────────────────────────────── */
export async function Home2001Content() {
  const [middle, right] = await Promise.all([
    Promise.all(MIDDLE_BOXES.map(loadBox)),
    Promise.all(RIGHT_BOXES.map(loadBox)),
  ]);
  const art = chromeUrl("left_logo_uo_1.gif", ERA);
  const mainArt = chromeUrl("forg_main_logo_1.gif", ERA);
  const shot = chromeUrl("best_screen.gif", ERA);

  return (
    <section aria-label="2001 메인 콘텐츠" className="bg-[#f8f8f8] py-2 text-[12px] leading-[1.35]">
      {/* `<table align=center border=1 bordercolor=#CCCCCC cellspacing=0 width=740>` */}
      <div className="mx-auto grid w-full max-w-[740px] grid-cols-1 border border-[#cccccc] min-[800px]:grid-cols-[150px_390px_200px]">
        <div className="border-[#cccccc] p-[2px] max-[799px]:hidden min-[800px]:border-r">
          {art && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- static export, recovered 145×609 art with its image map */}
              <img
                loading="lazy"
                src={art}
                alt=""
                width={145}
                height={609}
                useMap="#forg2001left"
                className="block"
              />
              <map name="forg2001left">
                {LEFT_MAP.map((area) => (
                  <area
                    key={area.coords}
                    shape="rect"
                    coords={area.coords}
                    href={area.href}
                    alt={area.label}
                    title={area.label}
                    {...(area.href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})}
                  />
                ))}
              </map>
            </>
          )}
        </div>
        <div className="border-[#cccccc] bg-[#fcfbe9] min-[800px]:border-r">
          {mainArt && (
            // eslint-disable-next-line @next/next/no-img-element -- static export, recovered 390×200 art
            <img
              loading="lazy"
              src={mainArt}
              alt="Honor & Sacrifice"
              width={390}
              height={200}
              className="mx-auto block max-w-full"
            />
          )}
          {middle.map((data) => (
            <BoxSection2001 key={data.box.id} data={data} />
          ))}
        </div>
        <div className="bg-[#f8f8f8]">
          {right.map((data) => (
            <BoxSection2001 key={data.box.id} data={data} />
          ))}
          <section aria-label="ScreenShot">
            <BoxHeader2001
              box={{
                id: "ScreenShot",
                label: "ScreenShot",
                asset: null,
                width: 200,
                height: 30,
                count: 0,
                dated: false,
              }}
            />
            {shot && (
              <Link href="/ScreenShot" className="flex justify-center py-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- static export, recovered 160×160 shot */}
                <img
                  loading="lazy"
                  src={shot}
                  alt="2001년 베스트 스크린샷"
                  width={160}
                  height={160}
                />
              </Link>
            )}
          </section>
        </div>
        <div aria-hidden className="h-[20px] border-t border-[#cccccc] min-[800px]:col-span-3" />
      </div>
    </section>
  );
}

function BoxHeader2001({ box }: { box: Box2001 }) {
  const url = box.asset ? chromeUrl(box.asset, ERA) : null;
  return (
    <Link href={`/${box.id}`} className="block">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- static export, recovered header art
        <img
          loading="lazy"
          src={url}
          alt={box.label}
          width={box.width}
          height={box.height}
          className="mx-auto block max-w-full"
        />
      ) : (
        // `uoessay.gif` and `screen.gif` were never captured.
        <span
          className="mx-auto flex items-center bg-[#e6e6e6] px-2 font-bold text-[#404040]"
          style={{ maxWidth: box.width, height: box.height }}
        >
          {box.label}
        </span>
      )}
    </Link>
  );
}

function BoxSection2001({ data }: { data: BoxData }) {
  const bullet = chromeUrl("a.gif", ERA);
  return (
    <section aria-label={data.box.label} className="pb-3">
      <BoxHeader2001 box={data.box} />
      <ul className="px-[2px] pt-[2px]">
        {data.entries.map((entry) => (
          <li key={entry.postId} className="truncate">
            <Link
              href={`/${data.box.id}/${entry.postId}`}
              className="text-(--era-link) hover:text-(--era-link-hover) max-[799px]:block max-[799px]:py-[5px] max-[799px]:text-[14px]"
            >
              {bullet && (
                // eslint-disable-next-line @next/next/no-img-element -- static export, recovered bullet
                <img
                  loading="lazy"
                  src={bullet}
                  alt=""
                  width={5}
                  height={15}
                  className="mr-[2px] inline-block align-[-3px]"
                />
              )}
              {data.box.dated && <span className="mr-1">{monthDay(entry.createdAt)}</span>}
              {entry.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function monthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990) return "—";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
