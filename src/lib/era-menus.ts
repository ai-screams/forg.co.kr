/**
 * What the era frames link to: the top menus, the 2014 game categories, the
 * 2003 sidebar and the friend-site selects, in each original frame's order
 * and wording. The frames (`src/components/era-chrome-{2014,2003,2001}.tsx`)
 * draw them; `era-menus.test.ts` checks that every link reaches a board, a
 * `/site/` page or Wayback.
 */

import type { BoardId } from "@/lib/boards";

/* ──────────────────────────────────────────────────────────────────── */
/*  2014 (the 2014-12-18 capture)                                        */
/* ──────────────────────────────────────────────────────────────────── */

interface MenuButton2014 {
  id: BoardId;
  asset: string;
  hoverAsset: string;
  label: string;
}

export const TOP_MENU_2014: readonly MenuButton2014[] = [
  {
    id: "UoBoard2",
    asset: "t_b_freeboard.gif",
    hoverAsset: "t_b_freeboard_1.gif",
    label: "자유게시판",
  },
  { id: "porato", asset: "t_b_photo.gif", hoverAsset: "t_b_photo_1.gif", label: "포토갤러리" },
  { id: "FunBoard", asset: "t_b_fun.gif", hoverAsset: "t_b_fun_1.gif", label: "펀보드" },
  { id: "Reveal", asset: "t_b_movie.gif", hoverAsset: "t_b_movie_1.gif", label: "스포일러게시판" },
  { id: "Boo", asset: "t_b_boo.gif", hoverAsset: "t_b_boo_1.gif", label: "뽐뿌" },
  { id: "Shop", asset: "t_b_tra.gif", hoverAsset: "t_b_tra_1.gif", label: "거래" },
  { id: "Trash", asset: "t_b_trash.gif", hoverAsset: "t_b_trash_1.gif", label: "휴지통게시판" },
];

// Labels and `title`s are the 2014-12-18 sidebar verbatim, including the
// leading dash the original used as its bullet.
export const GAME_CATEGORIES_2014: readonly { id: BoardId; label: string; title: string }[] = [
  { id: "Ultima", label: "-울티마온라인", title: ":::UltimaOnline:::" },
  { id: "Diablo", label: "-디아블로3", title: ":::Diablo3:::" },
  { id: "DF", label: "-던전앤파이터", title: ":::DF Board:::" },
  { id: "LoL", label: "-리그오브레전드", title: ":::LoL:::" },
  { id: "Star2", label: "-스타크래프트2", title: ":::Starcraft2:::" },
  { id: "Console", label: "-콘솔게임", title: ":::XBOX,PS3,Wii,PSP:::" },
];

/** The three sites forg's sidebar linked as family, verbatim from the
 *  2014-12-18 capture. All three are gone; the museum keeps the names. */
export const FAMILY_SITES_2014: readonly string[] = ["Zeme", "Kritz", "Cindee"];

/* ──────────────────────────────────────────────────────────────────── */
/*  2003 (frame-top-2003 and frame-left-2003, 2003-06-03)                */
/* ──────────────────────────────────────────────────────────────────── */

// Top 7-button menu (frame-top-2003.html) — 80×20 each + 20×20 FAQ icon.
export const TOP_MENU_2003: readonly { id: BoardId; asset: string; label: string }[] = [
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

/** frame-left-2003's Friend Site select, in its order; null is a `---------`
 *  divider. Every uospace.net friend site it led to is gone. */
const FRIEND_SITES_2003: readonly (string | null)[] = [
  "Uospace",
  null,
  "Kritz",
  null,
  "Badaro",
  "Yui",
  "Harp",
  "Sazabi",
  "SIRL",
];

interface SidebarSection {
  /** Section header asset (English-titled GIF in chrome dir). */
  asset: string;
  /** The header's name: its alt text, and the phone menu's heading. */
  label: string;
  /** A jump menu under the header, before the links (`InertJumpMenu`). */
  jumpMenu?: { id: string; options: readonly (string | null)[] };
  links: readonly { label: string; href: string }[];
}

// Sidebar (frame-left-2003) — 5 sections with English chrome-bar
// headers and Korean dash-prefixed link rows. Hrefs follow the original
// frame; the guide pages it opened are `/site/…` documents (ETL Stage 2g).
// The guild directory was a popup (`/_zb/guild/index.html`), now a `/site/`
// page. The vendor popup (`/_zb/vendor/list.php`) has only a redirect
// capture, so that entry keeps the Vendor board. The cartoon lived on
// another host (`hosting27.interpia98.net/~forg/lomo/`), now `/site/lomo/`.
// The bulk-deed page survives only as its redirect to the FAQ, which
// `/site/bod/bod/` repeats; the poll is `/_zb/kritz_vote/`.
export const SIDEBAR_2003: readonly SidebarSection[] = [
  {
    asset: "m_info.gif",
    label: "Information",
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
    label: "Cooperation",
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
    label: "Reminisce",
    links: [
      { label: "-UO.만화", href: "/site/lomo/index/" },
      { label: "-UO.여행기", href: "/site/spotlight/spot_130/" },
      { label: "-인테리어정보", href: "/site/decoration/deco/" },
      { label: "-아이템스샷란", href: "/Items" },
    ],
  },
  {
    asset: "m_forg.gif",
    label: "Forg.Board",
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
    label: "Friend Site",
    jumpMenu: { id: "friend-site-note", options: FRIEND_SITES_2003 },
    links: [
      { label: "SiteMap", href: "/site/skill/sitemap/" },
      // frame-left-2003 links it to the official Korean UO site, kept by Wayback.
      {
        label: "EA Korea",
        href: "https://web.archive.org/web/20030603171043/http://www.kr.uo.com/",
      },
    ],
  },
];

/* ──────────────────────────────────────────────────────────────────── */
/*  2001 (forg_t)                                                        */
/* ──────────────────────────────────────────────────────────────────── */

// forg_t's menu row, left to right, with the alt text each button had.
export const TOP_MENU_2001: readonly { asset: string; label: string; href: string }[] = [
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
