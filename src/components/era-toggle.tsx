"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_ERA, ERA_LABELS, ERA_STORAGE_KEY, ERAS, isEra, type Era } from "@/lib/era";

/**
 * 2014 · 2003 · 2001 시기를 즉시 전환하는 토글.
 *
 * 외부 상태(`<html data-era>` 속성과 `localStorage`)와의 동기화는
 * React 19 표준인 `useSyncExternalStore`로 처리한다. `useEffect` +
 * `setState` 패턴은 React Compiler가 cascading render로 보고 경고하므로
 * 외부 상태 구독 패턴이 더 적합하다.
 *
 * 같은 탭 안에서 여러 EraToggle 인스턴스가 동기화되도록 커스텀 이벤트
 * (`forg:era-change`)를 dispatch한다. 다른 탭의 변경은 `storage` 이벤트로
 * 받아 이 탭의 `<html data-era>`에 옮긴다.
 *
 * 눌린 버튼의 색은 React 상태가 아니라 `src/styles/eras.css`의 `data-era` 규칙이
 * 칠한다. 스크립트가 돌기 전(SSR 상태는 늘 2014)에도 저장된 시기가 켜져
 * 보이게 하기 위해서다.
 */
const ERA_CHANGE_EVENT = "forg:era-change";

function getEraSnapshot(): Era {
  const era = document.documentElement.dataset["era"];
  return isEra(era) ? era : DEFAULT_ERA;
}

function getServerEraSnapshot(): Era {
  return DEFAULT_ERA;
}

function subscribeEra(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== ERA_STORAGE_KEY || !isEra(e.newValue)) return;
    document.documentElement.dataset["era"] = e.newValue;
    callback();
  };
  window.addEventListener(ERA_CHANGE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ERA_CHANGE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function EraToggle() {
  const era = useSyncExternalStore(subscribeEra, getEraSnapshot, getServerEraSnapshot);

  return (
    <div
      role="group"
      aria-label="디자인 시기 전환"
      className="inline-flex items-center gap-1 rounded-full border border-(--era-input-border) bg-(--era-content-bg) px-2 py-1 text-xs"
    >
      {/* Three eras and the search link share a 375px phone's header row. */}
      <span className="text-forg-ghost px-1 font-mono uppercase max-[399px]:hidden">era</span>
      {ERAS.map((candidate) => {
        const active = era === candidate;
        return (
          <button
            key={candidate}
            type="button"
            aria-pressed={active}
            data-era-option={candidate}
            onClick={() => {
              document.documentElement.dataset["era"] = candidate;
              try {
                localStorage.setItem(ERA_STORAGE_KEY, candidate);
              } catch {
                // private mode 등 — 무시
              }
              window.dispatchEvent(new Event(ERA_CHANGE_EVENT));
            }}
            className="text-forg-muted hover:bg-forg-cream hover:text-forg-ink min-w-11 rounded-full px-2 py-0.5 font-mono text-xs transition-colors sm:min-w-12"
          >
            {ERA_LABELS[candidate]}
          </button>
        );
      })}
    </div>
  );
}
