/**
 * /policy/ — who owns what on the museum's pages, and how to have a post
 * taken down. The footer links here. Drawn like the search page: a card in
 * the root layout's header and footer, outside `<EraShell>`, in the era's
 * panel colours.
 *
 * The internal procedure behind it (who handles a request, what a removal
 * touches) is `.docs/policies/takedown-policy.md`; the licensing decision is
 * ADR-0014. The page promises no response times.
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "저작권과 삭제 요청 — forg.co.kr",
  description: "forg.co.kr 디지털 박물관의 저작권 안내와 글 삭제 요청 방법",
};

const CONTACT_EMAIL = "commander@ai-scream.ai";

const OWNERS: readonly (readonly [string, string])[] = [
  ["글·댓글·글에 붙은 그림", "각 작성자"],
  ["사이트 모양(로고·단추·배경 그림)", "forg.co.kr 원 운영자"],
  [
    "게임 이름과 게임 화면",
    "각 게임사 — Ultima Online © Electronic Arts, World of Warcraft © Blizzard Entertainment 등. 박물관은 게임사와 관계가 없습니다.",
  ],
  ["박물관 프로그램 코드", "MIT 라이선스"],
];

const h2 = "mt-6 mb-2 border-b-2 border-forg-gold pb-1 text-base font-bold";
const h3 = "mt-4 mb-1 font-bold";
const list = "mb-3 space-y-0.5 pl-5";
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
            <thead>
              <tr>
                <th className="border border-(--era-input-border) bg-forg-gold/20 px-2 py-1.5 text-left">
                  무엇
                </th>
                <th className="border border-(--era-input-border) bg-forg-gold/20 px-2 py-1.5 text-left">
                  권리
                </th>
              </tr>
            </thead>
            <tbody>
              {OWNERS.map(([what, who]) => (
                <tr key={what}>
                  <td className="w-[36%] border border-(--era-input-border) px-2 py-1.5 align-top">
                    {what}
                  </td>
                  <td className="border border-(--era-input-border) px-2 py-1.5 align-top">
                    {who}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-3">
            박물관은 글과 그림을 다른 곳에 옮겨 쓰도록 허락할 수 없습니다. 옮겨 쓰려면 작성자의
            동의가 필요합니다.
          </p>

          <h2 className={h2}>삭제 요청</h2>
          <p className="mb-2">다음 경우에 사이트에서 내려 달라고 요청할 수 있습니다.</p>
          <ul className={`${list} list-disc`}>
            <li>본인이 쓴 글이나 댓글</li>
            <li>본인에게 권리가 있는 그림</li>
            <li>본인의 실명·연락처 같은 개인정보가 드러난 글 (본인이 쓰지 않았어도)</li>
            <li>forg.co.kr 원 운영자의 자산, 또는 위 경우의 대리인</li>
          </ul>

          <h3 className={h3}>보낼 곳</h3>
          <p className="mb-3">
            <a href={`mailto:${CONTACT_EMAIL}`} className={link}>
              {CONTACT_EMAIL}
            </a>
          </p>

          <h3 className={h3}>적어 주실 것</h3>
          <ol className={`${list} list-decimal`}>
            <li>내릴 글의 주소 — 주소창에 보이는 것 (예: …/UoBoard/26397/)</li>
            <li>이유 — 저작권, 개인정보, 그 밖의 사정</li>
            <li>회신 받을 연락처</li>
            <li>
              (있으면) 본인이 쓴 글임을 알 수 있는 단서 — 당시 아이디, 글 속 내용 등. 없어도 됩니다.
            </li>
          </ol>

          <h3 className={h3}>처리</h3>
          <ul className={`${list} list-disc`}>
            <li>요청을 받으면 받았다고 회신하고, 확인하는 대로 처리합니다.</li>
            <li>내리기로 하면 그 글의 쪽과 검색 결과, 그 글의 그림을 사이트에서 내립니다.</li>
            <li>
              다른 사람의 글을 본인 것이라 하는 요청이나 게시판 전체처럼 범위가 아주 넓은 요청은
              바로 처리하지 않고, 연락드려 함께 정합니다.
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

          <p className="text-xs text-forg-muted">
            박물관과의 연락으로 해결되지 않으면{" "}
            <a href="https://www.copyright.or.kr" className={link}>
              한국저작권위원회
            </a>
            에 조정을 신청할 수 있습니다.
          </p>
        </div>
      </article>
    </div>
  );
}
