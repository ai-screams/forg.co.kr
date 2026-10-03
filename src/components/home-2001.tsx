/**
 * Museum landing — 2001 era home (ADR-0019): forg_b, the front page. The
 * top frame (`FrameTop2001`) is `era-chrome-2001.tsx`.
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

import { LazyImg } from "@/components/lazy-img";
import type { BoardId } from "@/lib/boards";
import { chromeUrl } from "@/lib/chrome";
import { formatMonthDay } from "@/lib/dates";
import type { Era } from "@/lib/era";
import { getRecentPostEntries } from "@/lib/posts";
import type { BoardIndexEntry } from "@/types/post";

const ERA: Era = "2001";

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
  return { box, entries: recent.entries };
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: forg_b — the front page                                         */
/* ────────────────────────────────────────────────────────────────────── */
export async function Home2001Content() {
  const [middle, right] = await Promise.all([
    Promise.all(MIDDLE_BOXES.map(loadBox)),
    Promise.all(RIGHT_BOXES.map(loadBox)),
  ]);
  return (
    <section aria-label="2001 메인 콘텐츠" className="bg-[#f8f8f8] py-2 text-[12px] leading-[1.35]">
      {/* `<table align=center border=1 bordercolor=#CCCCCC cellspacing=0 width=740>` */}
      <div className="frame:grid-cols-[150px_390px_200px] mx-auto grid w-full max-w-[740px] grid-cols-1 border border-[#cccccc]">
        <div className="max-frame:hidden frame:border-r border-[#cccccc] p-[2px]">
          <LazyImg
            src={chromeUrl("left_logo_uo_1.gif", ERA)}
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
        </div>
        <div className="frame:border-r border-[#cccccc] bg-[#fcfbe9]">
          <LazyImg
            src={chromeUrl("forg_main_logo_1.gif", ERA)}
            alt="Honor & Sacrifice"
            width={390}
            height={200}
            className="mx-auto block max-w-full"
          />
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
            <Link href="/ScreenShot" className="flex justify-center py-1">
              <LazyImg
                src={chromeUrl("best_screen.gif", ERA)}
                alt="2001년 베스트 스크린샷"
                width={160}
                height={160}
              />
            </Link>
          </section>
        </div>
        <div aria-hidden className="frame:col-span-3 h-[20px] border-t border-[#cccccc]" />
      </div>
    </section>
  );
}

function BoxHeader2001({ box }: { box: Box2001 }) {
  const url = box.asset ? chromeUrl(box.asset, ERA) : null;
  return (
    <Link href={`/${box.id}`} className="block">
      {url ? (
        <LazyImg
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
              className="max-frame:block max-frame:py-[5px] max-frame:text-[14px] text-(--era-link) hover:text-(--era-link-hover)"
            >
              <LazyImg
                src={bullet}
                alt=""
                width={5}
                height={15}
                className="mr-[2px] inline-block align-[-3px]"
              />
              {data.box.dated && <span className="mr-1">{formatMonthDay(entry.createdAt)}</span>}
              {entry.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
