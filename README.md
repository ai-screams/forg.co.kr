# forg.co.kr — 디지털 박물관

> 한국 울티마 온라인의 가장 큰 팬사이트였던 **forg.co.kr**(1998–2016)을 Wayback Machine 캡처에서 되살려 보존하는 비영리 디지털 박물관입니다.

**운영 중:** <https://forg.co.kr>

---

## 무엇인가

**forg.co.kr**(통칭 "포그홈")은 한국 울티마 온라인 커뮤니티의 본거지였습니다. Wayback 캡처와 수집된 게시글에는 관리자 계정 **Forg**(`member_no=1`)가 반복해서 나오며, Kritz와는 `Forg&Kritz`로 함께 표기된 자매 사이트였습니다. 2006년 [진솔 비리 사건](https://namu.wiki/w/%EC%A7%84%EC%86%94%20%EB%B9%84%EB%A6%AC%20%EC%82%AC%EA%B1%B4)의 폭로 무대로도 한국 게임사에 기록된 사이트입니다.

이 프로젝트는 문을 닫은 forg.co.kr을 [Internet Archive Wayback Machine](https://web.archive.org)에 보존된 캡처로부터 복원합니다.

- 시대별 시각 디자인을 그대로 살립니다 — 2014 슬레이트 + 골드(기본), 2003 프레임셋, 2001 첫 화면.
- 게시글 **14,237개를** 정적 페이지로 빌드해 영구 보존합니다.
- 검색처럼 지금의 웹이 줄 수 있는 기능을 더해 후세에 전합니다.

**forg.kr은** 2019년 Wayback 캡처에서 후속 사이트 흔적이 확인되지만, 2026년 5월 2일 현재 `forg.kr`·`www.forg.kr` DNS 레코드는 확인되지 않습니다. 이 박물관은 **forg.co.kr 시기(1998–2016)의** 기록을 보존합니다.

---

## 사이트 정체성 (재현 대상)

| 항목             | 값                                                            |
| ---------------- | ------------------------------------------------------------- |
| 원본 도메인      | `forg.co.kr` (1998–2016). 지금은 이 박물관이 이 도메인에 있음 |
| 관리자 계정      | Forg (`member_no=1`, 자매 사이트 Kritz와 `Forg&Kritz`로 표기) |
| 위상             | "한국 울티마 온라인 가장 큰 팬사이트" (namu.wiki 등의 표기)   |
| 게시판 엔진      | Zeroboard 4.0 → 4.1pl4 → Gnuboard4 → forg.kr 캡처상 Gnuboard5 |
| 시그니처 색      | `#FFC73B` (골드) — 15년간 변치 않은 상징                      |
| 게시판 수        | UO 코어 12개 + 커뮤니티·거래·유머 등 22개                     |
| 누적 방문 (2014) | 약 5,291만                                                    |

운영 기간은 사이트 자신의 표기(2014년 첫 화면의 "Since 1998")와 기록으로 잡았습니다. 보존된 가장 오래된 글은 2000-10-09, 마지막 글은 2016-03-09이고, 게시판이 정상 응답한 마지막 캡처는 2016-08-20입니다(9월부터는 리다이렉트만 남음).

---

## 박물관에 있는 것

2026-10-07 기준입니다.

| 무엇        | 규모                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| 게시글      | 14,237개 (게시판 45곳), 댓글 57,313개                                                                  |
| 목록 행     | 41,976행 (게시판 59곳) — 본문이 남지 않은 글도 제목·작성자·날짜로 남김                                 |
| 게시판 목록 | 66곳, 1,231쪽 (쪽당 50행) — 목록만 남은 게시판, 회원 전용이라 비어 있는 게시판 포함                    |
| 안내 페이지 | 877쪽 + 옛 캡처 판 399쪽 (가이드·지도·길드·만화·설문·첫 화면 프레임셋)                                 |
| 그림        | 글·안내 페이지 그림 3,391개. 게시글 본문 사진은 30%(1,477 / 4,850)를 되찾았고, 나머지는 Wayback에 없음 |
| 정적 HTML   | 16,777개                                                                                               |

---

## 기능

### 지금 있는 것

- **시대 전환** — 2014(기본)·2003·2001 화면을 버튼 하나로 바꿉니다. 처음 온 사람에게는 버튼이 옛 모습을 보여 준다는 안내가 뜹니다.
- **원본 충실 + 휴대폰 해석** — 너비 800px 이상에서는 원본의 치수와 자산을 그대로 씁니다. 그보다 좁은 화면은 같은 팔레트로 다시 짠 박물관의 해석입니다.
- **원본 게시판 스킨** — Zeroboard·Gnuboard 스킨, 공지·답글 표시, 2001년 게시판 스킨.
- **안내 페이지** — 원본 문서를 그대로 보여 주고, 같은 쪽의 옛 캡처 판을 고를 수 있습니다(`/site/`).
- **정적 검색** — Pagefind 색인으로 백엔드 없이 한글 본문을 검색합니다(`/search/`).
- **옛 주소 연결** — 다른 사이트에 남은 옛 forg.co.kr 글·안내 페이지·그림 주소를 박물관의 같은 자리로 영구 이동(301)시킵니다.
- **검색 노출** — sitemap, canonical, 구조화 데이터, IndexNow.
- **가벼운 쪽** — 콘텐츠 쪽은 React 런타임 없이 내보냅니다.
- **저작권과 삭제 요청 안내** — `/policy/`.

### 예정

- **댓글** — Giscus(GitHub Discussions)로 옛 글에 새 추억담을 남기기
- **검색 필터·정렬**
- **회원 글쓰기** — 맨 마지막

---

## 기술 스택

```text
프레임워크   Next.js 16 (App Router, Turbopack, static export)
런타임       React 19 (Server Components)
언어         TypeScript 6 (strict)
스타일       Tailwind CSS v4 (CSS-first, OKLCH 토큰)
패키지       pnpm 10.33
검색         Pagefind 1.4.0 (색인은 Cloudflare R2)
호스팅       Cloudflare Pages + Pages Function 하나 (옛 주소 연결)
그림         Cloudflare R2 (img.forg.co.kr)
ETL          Python 3 + BeautifulSoup4 · lxml · nh3 · Pydantic
품질         ESLint · Prettier · markdownlint · knip · secretlint · size-limit
테스트       Vitest · pytest
댓글         Giscus (예정)
```

---

## 로컬 개발

### 요구사항

- Node.js 24 (`.nvmrc`)
- pnpm 10.33 (`packageManager`에 고정, Corepack 권장)
- Python 3.12 (ETL만, `.venv` 가상환경)

### 설치와 실행

```bash
pnpm install

# 개발 서버 → http://localhost:3000
pnpm dev

# 정적 빌드 → out/ (빌드 뒤 Pagefind 색인과 옛 주소 계획까지)
pnpm build

# 빌드 결과를 Cloudflare Pages처럼 띄우기 (Pages Function 포함)
pnpm dlx wrangler@4 pages dev out
```

게시글 그림 파일은 git에 없고 R2에 있습니다. 그림 파일이 없어도 빌드는 됩니다(Cloudflare Pages도 그렇게 빌드합니다). 환경 변수 `NEXT_PUBLIC_IMG_BASE=https://img.forg.co.kr`를 주면 그림을 R2에서 바로 불러오고, `pnpm img:pull`은 R2에서 없는 파일만 받아 옵니다(R2 자격 증명 필요).

### 검사

| 명령                | 하는 일                      |
| ------------------- | ---------------------------- |
| `pnpm typecheck`    | `tsc --noEmit`               |
| `pnpm test`         | Vitest (`src/**/*.test.ts`)  |
| `pnpm lint`         | ESLint                       |
| `pnpm lint:md`      | markdownlint                 |
| `pnpm format:check` | Prettier                     |
| `pnpm secret`       | secretlint                   |
| `pnpm knip`         | 쓰지 않는 export·파일·의존성 |
| `pnpm size`         | JS 200KB·CSS 50KB 예산       |

ETL 테스트는 `.venv/bin/python3 -m pytest scripts/etl/tests -q`입니다. GitHub CI는 위 검사와 ETL 테스트를 돌리고, 빌드는 Cloudflare Pages가 push마다 합니다.

### ETL (게시글 데이터 만들기)

Wayback 캡처 원본은 저장소에 없고, CDX로 다시 받을 수 있습니다. Wayback에는 한 번에 하나씩, 4초 넘는 간격으로만 요청합니다.

```bash
# 1) Wayback에서 캡처 받기 (bronze)
.venv/bin/python3 scripts/etl/download.py --phase A

# 2) EUC-KR → UTF-8, Wayback 틀 제거 (silver)
.venv/bin/python3 scripts/etl/01-decode.py

# 3) 엔진·스킨마다 파서 하나 → src/content/ (gold)
#    02 Zeroboard 4.1 · 02b Gnuboard4 · 02c 목록 · 02d Gnuboard5
#    02e link/diary 스킨 · 02f Zeroboard 4.0 · 02g 안내 페이지 · 02h 답글 양식
.venv/bin/python3 scripts/etl/02-parse-zeroboard.py

# 4) 게시판 목록 쪽 만들기
.venv/bin/python3 scripts/etl/03-build-index.py
```

그림 회수(주소 추출 → CDX 조회 → 다운로드 → 본문 주소 바꾸기)와 스크립트마다의 재실행 주의점은 [`scripts/etl/AGENTS.md`](scripts/etl/AGENTS.md)에 있습니다.

---

## 프로젝트 구조

```text
forg/
├── src/
│   ├── app/              # 라우트: 첫 화면, 게시판·글, /site/, /search/, /policy/
│   ├── components/       # 시대 틀(era-chrome-*), 첫 화면(home-*), 목록·글 스킨
│   ├── lib/              # 데이터 읽기, 시대·스킨·메뉴, 날짜, 옛 주소, SEO
│   ├── styles/           # 토큰·시대·스킨 CSS
│   ├── types/            # Post 등 (scripts/etl/schemas.py와 짝)
│   └── content/          # ETL 결과 JSON: posts, boards, listings, pages, page-versions
├── functions/            # Pages Function: 옛 forg.co.kr 주소 → 박물관
├── public/               # _headers, robots.txt, og.png, img/chrome·emoticon (img/posts는 R2)
├── scripts/
│   ├── etl/              # Python 파이프라인과 pytest
│   ├── postbuild/        # 빌드 뒤 단계 (React 런타임 제거, 옛 주소 계획 등)
│   ├── deploy/           # R2 업로드·받기, IndexNow
│   └── dev/              # 로컬 화면 확인 도구
└── .github/workflows/    # CI
```

---

## 출처와 저작권

### 콘텐츠 출처

- **게시글 본문·댓글·첨부**: forg.co.kr 사용자들이 쓴 글로, [Internet Archive Wayback Machine](https://web.archive.org)에 보존된 공개 캡처에서 가져옵니다.
- **사이트 디자인 자산**(로고, 버튼 등): forg.co.kr 원본 사이트의 자산입니다.
- **역사 설명**: Wayback 캡처, namu.wiki, thewiki.kr, ultimastory.tistory.com과 수집된 게시글 원문을 대조해 씁니다. `Nylugh` 관련 서술은 1차 출처를 확인하기 전까지 단정하지 않습니다.

### 저작권 / 정책

이 프로젝트는 **한국 게임 문화의 보존을** 목적으로 합니다. 영리 활동을 하지 않으며, 광고를 싣지 않습니다.

- 게시글 작성자가 본인 글의 삭제를 요청하시면 확인하는 대로 사이트에서 내립니다.
- 원 운영자, 관리자 계정 **Forg**, Kritz 관계자, forg.kr 후속 운영자의 의견을 존중합니다.
- 콘텐츠의 저작권은 각 작성자에게 있습니다.

문의·삭제 요청: pignuante &lt;[commander@ai-scream.ai](mailto:commander@ai-scream.ai)&gt;

---

## 참여

한국 UO 커뮤니티의 누구나 도울 수 있습니다. 아래는 이메일 [commander@ai-scream.ai](mailto:commander@ai-scream.ai)로 보내 주세요.

- **옛 자료** — Wayback 밖의 캡처, 다른 곳에 퍼 간 글, 갖고 계신 스크린샷이나 저장본
- **잘못된 복원** — 깨진 화면, 틀린 날짜·작성자, 빠진 글
- **추억담** — 사이트와 게시판에 얽힌 이야기

---

## 감사의 말

이 프로젝트는 다음 분들 덕분에 가능했습니다.

- **Forg 계정과 원 운영진** — forg.co.kr을 운영하며 한국 UO 커뮤니티의 거점을 만들어 주신 분들
- **forg.kr 후속 사이트 운영진** — 2019년 Wayback 캡처에서 확인되는 후속 사이트를 유지했던 분들
- **Internet Archive** — Wayback Machine으로 인터넷의 기억을 보존
- **forg.co.kr의 모든 글쓴이** — 익명·실명을 가리지 않고 한국 UO의 추억을 글로 남겨 주신 분들
- **namu.wiki·thewiki.kr 기여자** — 한국 UO와 진솔 사건의 사료를 정리

---

## 라이선스

코드와 콘텐츠의 조건이 다릅니다.

| 대상                                                                               | 조건                                                        | 파일                                     |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| **소스 코드와 문서** (`src/`(`src/content/` 제외), `scripts/`, `functions/`, 설정) | MIT License                                                 | [LICENSE](./LICENSE)                     |
| **콘텐츠** (게시글·댓글·그림·안내 페이지·사이트 디자인 자산)                       | 원저작자 권리 보유 — 박물관은 어떤 라이선스도 부여하지 않음 | [CONTENT-NOTICE.md](./CONTENT-NOTICE.md) |
| **게임 이름·스크린샷**                                                             | 각 권리자                                                   | [CONTENT-NOTICE.md](./CONTENT-NOTICE.md) |

### 박물관 보존 입장

이 박물관은 forg.co.kr(1998–2016) 한국 Ultima Online 커뮤니티 문화의 **비영리 교육·보존 프로젝트입니다.** 한국 저작권법 제35조의5(저작물의 공정한 이용)와 Internet Archive의 보존 정신에 따라 원본 콘텐츠를 정확히 재현합니다. 광고나 유료화 계획은 없습니다.

### 삭제 요청 (Takedown)

원 작성자, 저작권자, 영향을 받는 당사자의 콘텐츠 삭제 요청은 다음으로 받습니다.

- **이메일**: `commander@ai-scream.ai`

요청을 받으면 회신하고 확인하는 대로 처리합니다. 요청 방법과 처리는 박물관 사이트의 "저작권과 삭제 요청" 쪽(`/policy/`)에 있습니다.

---

> 한국 울티마 온라인의 추억은 우리에게서 영원히 사라지지 않습니다.
