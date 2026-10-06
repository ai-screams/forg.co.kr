/**
 * /policy/ — who owns what on the museum's pages, and how to have a post
 * taken down. The footer links here. Drawn like the search page: a card in
 * the root layout's header and footer, outside `<EraShell>`, in the era's
 * panel colours.
 *
 * The internal procedure behind it (what a removal touches: the post, its
 * list row, its pictures on R2, the search bundle, older deployments) is
 * `.docs/policies/takedown-policy.md`; the licensing decision is ADR-0014.
 * The page promises no response times.
 */

import type { Metadata } from "next";

import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({
  title: "저작권과 삭제 요청 — forg.co.kr",
  description: "forg.co.kr 디지털 박물관의 저작권 안내와 글 삭제 요청 방법",
  path: "/policy/",
});

const CONTACT_EMAIL = "commander@ai-scream.ai";

const OWNERS: readonly (readonly [string, string])[] = [
  ["글·댓글·글에 붙은 그림", "각 작성자"],
  ["사이트 모양(로고·단추·배경 그림)", "forg.co.kr 원 운영자"],
  [
    "게임 이름과 게임 화면",
    "각 게임사 — Ultima Online © Electronic Arts, World of Warcraft © Blizzard Entertainment 등. 박물관은 게임사와 관계가 없습니다.",
  ],
  ["박물관 프로그램 코드", "박물관 운영자 (MIT 라이선스로 공개)"],
];

const h2 = "mt-6 mb-2 border-b-2 border-forg-gold pb-1 text-base font-bold";
const h3 = "mt-4 mb-1 font-bold";
const list = "mb-3 space-y-0.5 pl-5";
const cell = "border border-(--era-input-border) px-2 py-1.5 text-left align-top";
const link = "text-(--era-link) underline underline-offset-2 hover:text-(--era-link-hover)";

export default function PolicyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
      <article className="rounded-md border border-(--era-input-border) bg-(--era-content-bg) shadow-sm">
        <header className="border-b border-(--era-input-border) px-6 py-5">
          <h1 className="text-xl font-bold text-forg-ink">저작권과 삭제 요청</h1>
          <p className="mt-1 text-xs text-forg-muted">forg.co.kr 디지털 박물관 운영 안내</p>
        </header>

        <div className="px-6 py-5 text-sm leading-relaxed text-forg-ink">
          <p className="mb-3">
            이 박물관은 한국 울티마 온라인 팬사이트 forg.co.kr(1998–2016)을 되살린{" "}
            <b>비영리 개인 보존 프로젝트</b>입니다. 광고를 싣지 않습니다. 글과 그림은 Internet
            Archive의 Wayback Machine에 남은 공개 캡처에서 가져왔습니다.
          </p>

          <h2 className={h2}>저작권</h2>
          <table className="mb-3 w-full border-collapse bg-white text-[13px]">
            <caption className="sr-only">박물관에 있는 것과 그 권리자</caption>
            <thead>
              <tr>
                <th scope="col" className={`${cell} bg-forg-gold/20`}>
                  무엇
                </th>
                <th scope="col" className={`${cell} bg-forg-gold/20`}>
                  권리자
                </th>
              </tr>
            </thead>
            <tbody>
              {OWNERS.map(([what, who]) => (
                <tr key={what}>
                  <th scope="row" className={`${cell} w-[36%] font-normal`}>
                    {what}
                  </th>
                  <td className={cell}>{who}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-3">
            박물관은 글과 그림의 이용 허락을 대신 내줄 수 없습니다. 이용 허락은 각 권리자에게 받아
            주세요.
          </p>

          <h2 className={h2}>삭제 요청</h2>
          <p className="mb-2">다음은 사이트에서 내려 달라고 요청하실 수 있습니다.</p>
          <ul className={`${list} list-disc`}>
            <li>본인이 쓴 글이나 댓글</li>
            <li>본인에게 권리가 있는 그림</li>
            <li>본인의 실명·연락처 같은 개인정보가 드러난 글 (본인이 쓰지 않았어도)</li>
            <li>(forg.co.kr 원 운영자라면) 사이트 모양과 운영진의 글</li>
            <li>(게임사라면) 게임 화면과 자료</li>
          </ul>
          <p className="mb-3">대리인을 통해 요청하셔도 됩니다.</p>

          <h3 className={h3}>보낼 곳</h3>
          <p className="mb-3">
            <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
              {CONTACT_EMAIL}
            </a>
          </p>

          <h3 className={h3}>적어 주실 것</h3>
          <ol className={`${list} list-decimal`}>
            <li>
              내릴 글의 주소 — 주소창에 보이는 것 (…/게시판이름/글번호/). 댓글이면 그 글의 주소와
              댓글을 쓴 이름·날짜
            </li>
            <li>이유 — 저작권, 개인정보, 그 밖의 사정</li>
            <li>회신 받을 연락처</li>
            <li>요청하시는 분과 그 글의 관계를 알 수 있는 단서 — 당시 아이디 등 (없어도 됩니다)</li>
          </ol>

          <h3 className={h3}>처리</h3>
          <ul className={`${list} list-disc`}>
            <li>요청을 받으면 받았다고 회신하고, 확인하는 대로 처리합니다.</li>
            <li>
              내리기로 하면 그 글의 쪽과 게시판 목록의 줄, 검색 결과, 그 글의 그림을 사이트에서
              내립니다.
            </li>
            <li>
              다른 사람의 글을 본인 것이라 하는 요청이나 게시판 전체처럼 범위가 아주 넓은 요청은
              내리기 전에 연락드려 함께 정합니다.
            </li>
          </ul>

          <h3 className={h3}>Wayback Machine의 원본</h3>
          <p className="mb-3">
            원본 캡처는 Internet Archive가 보관하므로 박물관에서 지울 수 없습니다. 그쪽에서도
            지우려면{" "}
            <a href="mailto:info@archive.org" className={link}>
              info@archive.org
            </a>
            로 주소와 기간을 적어 따로 요청해 주세요.
          </p>

          <h3 className={h3}>해결되지 않으면</h3>
          <ul className={`${list} list-disc`}>
            <li>
              저작권 문제는{" "}
              <a href="https://www.copyright.or.kr" className={link}>
                한국저작권위원회
              </a>
              에 조정을 신청할 수 있습니다.
            </li>
            <li>
              개인정보 문제는{" "}
              <a href="https://www.kopico.go.kr" className={link}>
                개인정보분쟁조정위원회
              </a>
              에 조정을 신청할 수 있습니다.
            </li>
          </ul>
        </div>
      </article>
    </div>
  );
}
