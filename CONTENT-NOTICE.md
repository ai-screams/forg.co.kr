# forg.co.kr 박물관 콘텐츠 권리 안내

이 저장소는 forg.co.kr(1998–2016)의 디지털 박물관 재현 프로젝트입니다. 저작권을 가진 쪽이 다른 자산이 함께 있어서, 코드와 콘텐츠의 조건이 다릅니다.

| 대상                                                                                           | 조건                                       | 비고                                           |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| **코드와 문서** (`src/`, `scripts/`, `functions/`, `.github/`, 최상위 설정·문서)               | **MIT License** ([LICENSE](./LICENSE))     | 박물관 운영자가 작성한 코드와 문서             |
| **콘텐츠** (`src/content/`, `public/img/posts/`, `public/img/chrome/`, `public/img/emoticon/`) | **원저작자 권리 보유**                     | 박물관은 콘텐츠에 라이선스를 부여하지 않습니다 |
| **Wayback 원본 캡처** (저장소에 없음)                                                          | Internet Archive 이용 약관 + 원저작자 권리 | 박물관을 만드는 과정에서만 사용                |

---

## 1. MIT License 적용 범위

MIT License는 다음에만 적용됩니다.

- `src/` — TypeScript·React·CSS 소스 코드 (**`src/content/` 제외**)
- `scripts/` — Python ETL 파이프라인, 빌드·배포 스크립트
- `functions/` — Cloudflare Pages Function
- `.github/` — CI 워크플로
- 최상위 설정 파일 (`next.config.ts`, `tsconfig.json`, `package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`, `commitlint.config.mjs` 등)
- 문서: `README.md`, `CLAUDE.md`, `AGENTS.md`, `LICENSE`, 이 파일

### MIT License에서 명시적으로 제외하는 것

- `src/content/posts/**/*.json` — 게시글·댓글 (§2)
- `src/content/boards/`, `src/content/listings/` — 게시판 목록 (게시글 메타데이터에서 나온 것, §2)
- `src/content/pages/`, `src/content/page-versions/` — 원본 사이트의 안내 페이지 (§2)
- `public/img/posts/` — 본문 첨부 그림 (§2)
- `public/img/chrome/`, `public/img/emoticon/` — 사이트 디자인 자산과 이모티콘 (§2)
- Wayback 원본 캡처 HTML (저장소에 없음, §2)

---

## 2. 콘텐츠 — 원저작자 권리 보유 / Original Authors Retain All Rights

이 박물관에 실린 모든 **게시글, 댓글, 첨부 그림, 안내 페이지, 사이트 디자인 자산의** 저작권은 원 작성자 또는 forg.co.kr 원 운영자에게 있습니다.

박물관 운영자(pignuante)는 **콘텐츠에 어떤 라이선스도 부여하지 않으며**, Creative Commons 같은 재배포 허락도 하지 않습니다.

이 박물관의 콘텐츠를 2차 활용·재배포·가공하려면 **각 원저작자의 동의를** 직접 받아야 합니다. 박물관 운영자는 동의를 대신하지 않습니다.

### 박물관 보존 입장 (Fair Use Assertion)

이 박물관은 **forg.co.kr(1998–2016) 한국 Ultima Online 커뮤니티 문화를 보존하는 비영리 교육·아카이브 프로젝트입니다.** 다음 네 가지를 근거로 공정 이용 입장을 취합니다.

1. **비영리 목적** — 광고·유료 결제·구독이 없고, 도입할 계획도 없습니다.
2. **교육·보존 목적** — 한국 인터넷 문화사의 사료로서, 학술·회고 자료의 가치를 우선합니다.
3. **원본을 정확히 재현** — 수정을 최소화합니다. 시대별 화면 토큰 대응과 HTML 정화(nh3) 외에는 본문을 바꾸지 않습니다.
4. **시장 가치에 영향 없음** — forg.co.kr은 2016년에 이미 문을 닫았습니다. 이 박물관은 원 사이트의 대체재가 아니라 보존본입니다.

법적 근거:

- **한국 저작권법 제35조의5** — 저작물의 공정한 이용
- **17 U.S.C. §107** (미국 fair use) — 호스팅 위치에 따라 함께 적용될 수 있음
- Internet Archive의 보존 활동과 관련 판례 (Hachette v. IA 2nd Cir. 2024 등)

### 삭제 요청 / Takedown

원 작성자, 저작권자, 또는 영향을 받는 당사자는 콘텐츠 삭제를 요청할 수 있습니다.

- **이메일**: `commander@ai-scream.ai`

요청을 받으면 회신하고 확인하는 대로 처리합니다. 요청 방법과 처리는 박물관 사이트의 "저작권과 삭제 요청" 쪽(`/policy/`)에 있습니다.

### 출처 표시 안내 (선의로 인용할 때)

이 박물관의 콘텐츠를 인용·참고할 때는 다음을 권합니다. 라이선스가 없으므로 강제하지 않습니다.

- **출처**: "forg.co.kr 박물관 (`https://forg.co.kr`)"
- **원본**: "원 작성자 — forg.co.kr(1998–2016), Wayback Machine 보존본"
- **검증**: 각 게시글 JSON의 `capturedAt`(Wayback timestamp)으로 원 캡처 시점을 확인할 수 있습니다.

---

## 3. 게임 IP / Third-Party IP

이 박물관에 나오는 게임 이름, 스크린샷, 캐릭터, 로고는 아래 권리자의 자산이며, 박물관 운영자와 관계가 없습니다. 보존 목적의 비영리 인용으로 쓰며, 권리자가 요청하면 삭제합니다.

- **Ultima Online**: © 1997–현재 Electronic Arts Inc. / Broadsword Online Games
- **World of Warcraft**: © Blizzard Entertainment, Inc.
- **그 밖의 게임 (Lineage, Diablo, Dark Fall, League of Legends, StarCraft II)**: 각 권리자

---

## 4. Internet Archive

이 박물관의 모든 콘텐츠는 Internet Archive Wayback Machine(`https://web.archive.org/`)의 보존본을 ETL 파이프라인으로 가공·재구성한 것입니다.

Internet Archive의 활동이 없었다면 이 박물관은 있을 수 없습니다. Wayback 이용 약관(`https://archive.org/about/terms.php`)의 학술·보존 목적 이용 정신을 지킵니다.

---

## 5. 재검토 조건

다음 일이 생기면 이 안내를 다시 검토합니다.

1. forg.co.kr 원 운영자와 연락이 닿음 — 명시적 동의나 협의 결과를 반영
2. 한국 저작권법 제35조의5 관련 판례가 바뀜
3. 삭제 요청이 대량으로 들어옴 — 박물관 운영 자체를 재검토

---

**시행 2026-05-12 · 개정 2026-10-07 (LICENSE에서 분리) · 관리자 pignuante (`commander@ai-scream.ai`)**
