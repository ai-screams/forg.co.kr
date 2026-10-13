# 개발 안내

forg.co.kr 디지털 박물관을 만들고 고치는 사람을 위한 문서입니다. 박물관이 무엇이고 왜 만들었는지는 [README](./README.md)에 있습니다.

박물관은 Internet Archive Wayback Machine의 캡처를 Python ETL로 JSON으로 바꾸고, 그 JSON을 Next.js로 정적 사이트로 빌드해 Cloudflare Pages에 올립니다. 게시글 그림과 검색 색인은 Cloudflare R2에 있습니다.

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
#    02e 목록이 곧 글인 스킨 · 02f Zeroboard 4.0 · 02g 안내 페이지 · 02h 답글 양식
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
