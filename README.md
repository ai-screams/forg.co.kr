# forg.co.kr — 디지털 박물관

> 한국 울티마 온라인의 가장 큰 팬사이트였던 **forg.co.kr** (1999~2015)을
> 모던 웹 스택으로 재현·보존하는 비영리 아카이브 프로젝트.

🚧 **초기 개발 단계** — 데이터 수집과 사이트 골격을 구축 중입니다.

---

## 무엇인가

**forg.co.kr**(통칭 "포그홈")은 한국 울티마 온라인 커뮤니티의 본거지였습니다.
운영자 **Nylugh**와 자매 사이트 Kritz가 함께 운영했으며,
2006년 [진솔 비리 사건](https://namu.wiki/w/%EC%A7%84%EC%86%94%20%EB%B9%84%EB%A6%AC%20%EC%82%AC%EA%B1%B4)의
폭로 무대로도 한국 게임사에 기록된 사이트입니다.

이 프로젝트는 폐쇄된 forg.co.kr를 [Internet Archive Wayback Machine](https://web.archive.org)에
보존된 캡처로부터 복원하여:

- 시각 디자인을 그대로 살리고 (2014 슬레이트 + 골드, 2003 프레임셋 토글)
- 약 **13,727개의 게시글**을 정적으로 빌드하여 영구 보존하고
- 검색·댓글 등 모던 기능을 더해 후세에 전달합니다.

forg.co.kr의 정통 후속 사이트인 **[forg.kr](https://forg.kr)** 은 별도로 활발히 운영되고 있으며,
이 박물관은 그 자매 프로젝트가 아닌 **2015년 이전 forg.co.kr 시기 기록 보존**을 목적으로 합니다.

---

## 사이트 정체성 (재현 대상)

| 항목 | 값 |
|---|---|
| 원본 도메인 | `forg.co.kr` (1999~2015) |
| 운영자 | Nylugh (자매 사이트 Kritz와 공동) |
| 위상 | "한국 울티마 온라인 가장 큰 팬사이트" (namu.wiki 등 공식 표기) |
| 게시판 엔진 | Zeroboard 4.1pl4 → Gnuboard4 → (forg.kr) Gnuboard5 |
| 시그니처 색 | `#FFC73B` (골드) — 15년간 변치 않은 상징 |
| 게시판 수 | UO 코어 12개 + 커뮤니티/거래/유머 등 22개 |
| 누적 방문 (2014) | 약 5,291만 |

---

## 현재 진행 상황

| 영역 | 상태 |
|---|---|
| 사이트 리서치 (디자인·역사·게시판 구조) | ✅ 완료 |
| 아키텍처 결정 (5개 ADR) | ✅ 완료 |
| Phase A 다운로드 (UO 코어 11,035건) | 🔄 진행 중 |
| Phase B 다운로드 (커뮤니티 2,290건) | ⏳ 대기 |
| 첨부 이미지 다운로드 | ⏳ 대기 |
| ETL 파이프라인 (HTML → JSON) | ⏳ 대기 |
| Next.js 사이트 구현 | ⏳ 대기 |
| 배포 | ⏳ 대기 |

---

## 기술 스택

```
프레임워크   Next.js 15 (App Router, Static Export)
런타임       React 19 (Server Components)
언어         TypeScript 5.x (strict)
스타일       Tailwind CSS v4 (CSS-first config)
컴포넌트     shadcn/ui
패키지       pnpm
검색         Pagefind (정적 검색)
댓글         Giscus (GitHub Discussions)
호스팅       Vercel 또는 Cloudflare Pages
ETL          Python 3 + BeautifulSoup4
```

상세한 기술 결정 근거는 프로젝트 ADR(Architecture Decision Record)에 기록되어 있습니다.

---

## 핵심 기능 (예정)

- **시기 토글** — 2014 디자인(기본) ↔ 2003 디자인 즉시 전환 (CSS 변수 + `data-era` 속성)
- **읽기 전용 아카이브** — 13,727개 게시글이 정적 페이지로 영구 보존
- **정적 검색** — Pagefind 인덱스, 백엔드 없이 한글 본문 검색
- **댓글** — Giscus를 통한 GitHub Discussions 연동, 옛 글에 새 추억담 가능
- **첨부 이미지 보존** — UO 인게임 스크린샷, 하우스 데코 등 원본 보존

---

## 로컬 개발

> 🚧 아직 코드 스캐폴딩 전입니다. 아래는 셋업 후 사용할 명령어입니다.

### 요구사항

- Node.js 20+
- pnpm 9+
- Python 3.11+ (ETL 스크립트용)

### 설치

```bash
# 의존성 설치
pnpm install

# 개발 서버
pnpm dev
# → http://localhost:3000

# 정적 빌드
pnpm build

# 빌드 결과 미리보기
pnpm start
```

### ETL (게시글 데이터 빌드)

```bash
# 1) Wayback에서 게시글 다운로드 (~24시간 소요)
python3 scripts/etl/download.py --phase A

# 2) EUC-KR → UTF-8 변환
python3 scripts/etl/01-decode.py

# 3) HTML → JSON 파싱
python3 scripts/etl/02-parse-zeroboard.py
python3 scripts/etl/02b-parse-gnuboard4.py

# 4) 게시판 인덱스 생성
python3 scripts/etl/03-build-index.py

# 5) 검색 인덱스 빌드
pnpm build && pagefind --site out/
```

---

## 프로젝트 구조

```
forg/
├── README.md                  # 이 파일
├── .gitignore
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── public/
│   ├── img/
│   │   ├── chrome/            # forg 사이트 셸 자산 (로고, 버튼, 액센트)
│   │   └── posts/             # 게시글 첨부 이미지
│   └── pagefind/              # 빌드 후 생성: 검색 인덱스
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx           # 메인 (2014 6박스 그리드)
│   │   ├── (board)/[board]/
│   │   │   ├── page.tsx       # 게시판 목록
│   │   │   └── [postId]/page.tsx  # 게시글 본문
│   │   └── globals.css        # Tailwind v4 + 시기 토큰
│   ├── components/
│   │   ├── era-toggle.tsx     # 2003/2014 시기 전환
│   │   ├── header.tsx
│   │   ├── sidebar.tsx
│   │   ├── post-card.tsx
│   │   ├── giscus.tsx
│   │   └── ui/                # shadcn 컴포넌트
│   ├── content/
│   │   ├── posts/{board}/{id}.json   # 정제된 게시글 데이터
│   │   └── boards/{board}/index.json # 게시판 인덱스
│   ├── lib/
│   │   ├── data.ts
│   │   ├── boards.ts
│   │   └── era.ts
│   └── types/
│       └── post.ts
└── scripts/
    └── etl/                   # 데이터 파이프라인 (Python)
        ├── download.py
        ├── 01-decode.py
        ├── 02-parse-zeroboard.py
        ├── 02b-parse-gnuboard4.py
        └── 03-build-index.py
```

---

## 출처와 저작권

### 콘텐츠 출처

- **게시글 본문 / 댓글 / 첨부**: forg.co.kr 원본 사용자가 작성한 글로,
  [Internet Archive Wayback Machine](https://web.archive.org)에 보존된 공개 캡처에서 가져옵니다.
- **사이트 셸 자산** (로고, 버튼 등): forg.co.kr 운영진(Nylugh)이 제작한 디자인 자산.
- **역사적 설명**: namu.wiki, thewiki.kr, ultimastory.tistory.com 및 운영자 사후 메모.

### 저작권 / 정책

이 프로젝트는 **한국 게임 문화의 보존**을 목적으로 합니다.
영리 활동을 하지 않으며, 광고를 게재하지 않습니다.

- 게시글 작성자가 본인 글의 삭제를 요청하시면 **즉시 비공개 처리**합니다.
- 운영자 Nylugh 또는 forg.kr 관리자의 의견을 존중합니다.
- 콘텐츠 자체에 대한 저작권은 각 작성자에게 있습니다.

문의 / 삭제 요청: [hanyul.ryu@gmail.com](mailto:hanyul.ryu@gmail.com)

---

## 기여

이 프로젝트는 1인이 비공개로 시작했지만, 한국 UO 커뮤니티의 누구나 참여할 수 있습니다.

- 🐛 **버그 신고**: GitHub Issues
- 💡 **기능 제안**: GitHub Discussions
- 📜 **추억담 / 옛 자료 제공**: 이메일 또는 Issues
- 🛠️ **코드 기여**: Pull Request 환영

기여하기 전에 이 README와 (있다면) `CONTRIBUTING.md`를 확인해 주세요.

---

## 감사의 말

이 프로젝트가 가능한 것은 다음 분들 덕분입니다:

- **Nylugh** — forg.co.kr를 15년간 운영하며 한국 UO 커뮤니티의 거점을 만들어 주신 분
- **forg.kr 운영진** — forg의 정통을 이어 활발히 커뮤니티를 유지 중
- **Internet Archive** — Wayback Machine으로 인터넷의 기억을 보존
- **forg.co.kr의 모든 글쓴이들** — 익명·실명을 막론하고 한국 UO의 추억을 글로 남겨주신 분들
- **namu.wiki / thewiki.kr 기여자들** — 한국 UO와 진솔 사건의 사료를 정리

---

## 라이선스

- **소스 코드**: MIT License (TBD)
- **콘텐츠 (게시글)**: 각 원작자에게 저작권. 박물관 목적 인용·재현으로 한정.
- **사이트 셸 자산**: forg.co.kr 원본 디자인의 보존 사용. 영리 사용 금지.

라이선스 형태는 정식 배포 전에 최종 확정 예정입니다.

---

> *"The boulder never stops."*
>
> 한국 울티마 온라인의 추억은 우리에게서 영원히 사라지지 않습니다.
