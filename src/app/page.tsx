import { EraToggle } from "@/components/era-toggle";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-(--era-page-bg)">
      <header className="border-b border-(--era-input-border) bg-(--era-content-bg)">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-forg-ink font-forg text-xl font-bold">forg.co.kr</h1>
            <p className="text-forg-muted text-xs">
              한국 울티마 온라인 디지털 박물관 — 셸 미리보기
            </p>
          </div>
          <EraToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <section aria-labelledby="tokens-heading" className="space-y-6">
          <header>
            <h2 id="tokens-heading" className="text-forg-ink text-lg font-bold">
              디자인 토큰 시연
            </h2>
            <p className="text-forg-muted text-sm">
              우측 상단 <span className="font-mono">era</span> 토글로 시기를 전환하면 시기 의존
              토큰이 즉시 변합니다. forg 시그니처 골드와 본문 텍스트는 시기 무관입니다.
            </p>
          </header>

          <div className="grid gap-4 md:grid-cols-2">
            <SwatchCard
              title="페이지 배경 (era)"
              token="--era-page-bg"
              note="2014: 슬레이트 #61748B / 2003: 흰색"
              className="text-forg-cream bg-(--era-page-bg)"
            />
            <SwatchCard
              title="콘텐츠 영역 (era)"
              token="--era-content-bg"
              note="2014: 크림 / 2003: 라이트 그레이"
              className="text-forg-ink bg-(--era-content-bg)"
            />
            <SwatchCard
              title="좌측 사이드바 (era)"
              token="--era-sidebar-bg"
              note="2014: 라이트 그레이 / 2003: 다크 네이비"
              className="bg-(--era-sidebar-bg) text-(--era-sidebar-fg)"
            />
            <SwatchCard
              title="forg 시그니처 골드 (변하지 않음)"
              token="--color-forg-gold"
              note="15년간 동일 — bg-forg-gold"
              className="bg-forg-gold text-forg-ink"
            />
            <SwatchCard
              title="2014 액센트 — 세이지"
              token="--color-forg-sage"
              note="bg-forg-sage"
              className="bg-forg-sage text-forg-cream"
            />
            <SwatchCard
              title="다크 푸터 / 사이드 (공통 어두운 톤)"
              token="--era-footer-bg"
              note="2014/2003 모두 동일 슬레이트"
              className="text-forg-cream bg-(--era-footer-bg)"
            />
          </div>

          <div className="mt-6 rounded-md bg-(--era-content-bg) p-5 text-sm">
            <h3 className="text-forg-ink mb-2 font-bold">링크 색 데모</h3>
            <p className="text-forg-muted leading-relaxed">
              본문 안의{" "}
              <a href="#" className="text-(--era-link) underline hover:text-(--era-link-hover)">
                기본 링크
              </a>
              에 마우스를 올리면 forg 골드 hover 색이 적용됩니다. 시기를 바꾸면 기본 색만 달라지고
              hover는 골드를 유지합니다.
            </p>
          </div>
        </section>

        <section aria-labelledby="meta-heading" className="mt-12">
          <h2 id="meta-heading" className="text-forg-ink mb-3 text-lg font-bold">
            구현 노트
          </h2>
          <ul className="text-forg-muted list-disc space-y-1 pl-5 text-sm">
            <li>토큰은 Tailwind v4 CSS-first (`@theme`)에 OKLCH로 정의 (ADR-0006).</li>
            <li>시기별 오버라이드는 `:root[data-era=&quot;...&quot;]` 블록으로 분리.</li>
            <li>EraToggle 클릭 시 `&lt;html data-era&gt;` 속성만 변경 → 리렌더 없음.</li>
            <li>FOUC 방지 인라인 스크립트가 hydration 전에 저장된 시기를 적용.</li>
            <li>Body에 200ms transition을 걸어 시기 전환 시 부드럽게 페이드.</li>
          </ul>
        </section>
      </main>

      <footer className="text-forg-cream border-t border-(--era-input-border) bg-(--era-footer-bg)">
        <div className="mx-auto max-w-5xl px-6 py-4 text-xs">
          <p>
            forg.co.kr 디지털 박물관 · 디자인 토큰 셸 · <span className="font-mono">P0.5</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

interface SwatchCardProps {
  title: string;
  token: string;
  note: string;
  className: string;
}

function SwatchCard({ title, token, note, className }: SwatchCardProps) {
  return (
    <article
      className={[
        "rounded-md border border-(--era-input-border) p-5 shadow-sm transition-colors",
        className,
      ].join(" ")}
    >
      <h3 className="text-sm font-bold">{title}</h3>
      <code className="mt-2 inline-block font-mono text-xs opacity-80">{token}</code>
      <p className="mt-3 text-xs opacity-90">{note}</p>
    </article>
  );
}
