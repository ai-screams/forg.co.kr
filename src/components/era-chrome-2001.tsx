/**
 * 2001-era chrome (ADR-0019): forg_t, the top frame — the banner and the
 * 14-button menu — worn by every route through `<EraShell>`. The frameset
 * and the front page it sat over are described in `home-2001.tsx`.
 */

import Link from "@/components/link";

import { LazyImg } from "@/components/lazy-img";
import { chromeUrl } from "@/lib/chrome";
import type { Era } from "@/lib/era";

const ERA: Era = "2001";

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

/* ────────────────────────────────────────────────────────────────────── */
/*  Frame: top — banner and the 14-button menu (forg_t.htm)               */
/* ────────────────────────────────────────────────────────────────────── */
export function FrameTop2001() {
  return (
    <header className="bg-white">
      <div className="max-frame:flex-col flex bg-[#f8f8f8]">
        <Link href="/" aria-label="forg.co.kr 메인" className="block">
          <LazyImg
            src={chromeUrl("t_logo.gif", ERA)}
            alt="Ultima Online of Forg"
            width={380}
            height={35}
            className="block max-w-full"
          />
        </Link>
        <LazyImg
          src={chromeUrl("t_logo_r.gif", ERA)}
          alt="All Contents Copyright(C) 1999. FORG.COM. All right reserved."
          width={410}
          height={35}
          className="max-frame:hidden block max-w-full"
        />
      </div>
      <nav aria-label="2001 상단 메뉴" className="flex flex-wrap bg-[#f8f8f8]">
        <LazyImg
          src={chromeUrl("t_l.gif", ERA)}
          alt=""
          width={10}
          height={20}
          className="max-frame:hidden block"
        />
        {TOP_MENU_2001.map((item) => (
          <Link key={item.asset} href={item.href}>
            <LazyImg
              src={chromeUrl(item.asset, ERA)}
              alt={item.label}
              title={item.label}
              width={55}
              height={20}
              className="block"
            />
          </Link>
        ))}
        <LazyImg
          src={chromeUrl("t_r.gif", ERA)}
          alt=""
          width={10}
          height={20}
          className="max-frame:hidden block"
        />
      </nav>
    </header>
  );
}
