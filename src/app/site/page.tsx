/**
 * `/site/` — every static page recovered from outside the boards, by section.
 *
 * The pages themselves are standalone documents (`/site/{stem}/`, see
 * `[...path]/route.ts`); this index is the museum's way in, inside the same
 * era frame as the board pages.
 */

import type { Metadata } from "next";

import { EraShell } from "@/components/era-shell";
import { getAllSitePages, type SitePage } from "@/lib/site-pages";

export const metadata: Metadata = {
  title: "사이트 페이지 — forg.co.kr",
  description: "게시판 밖의 forg.co.kr — 스킬·던전·지도·여행기 같은 안내 페이지와 첫 화면 프레임",
};

/** Section names as the 2003 left menu called them (`frame-left-2003.html`). */
const SECTION_NAMES: Record<string, string> = {
  "": "첫 화면과 프레임",
  skill: "울온 기술 (skill)",
  skill_knowhow: "각종 유용한 정보 (skill_knowhow)",
  skill_index: "스킬 색인 (skill_index)",
  skill_newbie: "초보자 (skill_newbie)",
  dungeon: "몬스터 & 던전 (dungeon)",
  map: "울온 지도 (map)",
  spotlight: "UO 여행기 (spotlight)",
  decoration: "인테리어 정보 (decoration)",
  uocraft: "제작 (uocraft)",
  uoquest: "UO 퀘스트 (uoquest)",
  bod: "벌크 디드 (bod)",
  Diablo: "디아블로 II (Diablo)",
  _zb: "길드 정보 (_zb/guild)",
  lomo: "UO 만화 (lomo)",
  wow: "월드 오브 워크래프트 (wow)",
};

function sectionOf(page: SitePage): string {
  const i = page.stem.indexOf("/");
  return i < 0 ? "" : page.stem.slice(0, i);
}

export default async function SiteIndexPage() {
  const pages = (await getAllSitePages()).filter((p) => p.kind !== "redirect");
  const sections = new Map<string, SitePage[]>();
  for (const p of pages) {
    const s = sectionOf(p);
    sections.set(s, [...(sections.get(s) ?? []), p]);
  }
  const order = [...sections.keys()].sort((a, b) =>
    a === "" ? -1 : b === "" ? 1 : a.localeCompare(b),
  );

  return (
    <EraShell>
      <article className="text-forg-ink">
        <header className="pb-3">
          <h1 className="text-[14px] font-bold">사이트 페이지</h1>
          <p className="text-forg-muted mt-[2px] text-[11px]">
            게시판 밖에 있던 안내 페이지 {pages.length.toLocaleString("ko-KR")}쪽입니다. 원래 모습
            그대로 열리며, 페이지 안의 링크도 박물관 안에서 이어집니다.
          </p>
        </header>
        {order.map((s) => (
          <section key={s || "root"} className="mb-4">
            <h2 className="border-b border-(--era-input-border) pb-[2px] text-[12px] font-bold">
              {SECTION_NAMES[s] ?? s}
            </h2>
            <ul className="mt-1 grid grid-cols-1 gap-x-4 text-[12px] sm:grid-cols-2">
              {(sections.get(s) ?? [])
                .sort((a, b) => a.stem.localeCompare(b.stem))
                .map((p) => (
                  <li key={p.stem} className="truncate">
                    <a href={`/site/${p.stem}/`} className="hover:underline">
                      {p.title}
                    </a>
                    <span className="text-forg-muted ml-1 text-[10px]">
                      {p.originalPath} · {p.capturedAt.slice(0, 4)}
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </article>
    </EraShell>
  );
}
