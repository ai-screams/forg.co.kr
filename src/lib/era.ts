/**
 * forg.co.kr era system — 시기별 디자인 토글
 *
 * 네 시기를 토글하여 같은 콘텐츠를 다른 시각 셸에서 렌더링한다. 2014·2003·2001은
 * 원본을 재현한 것이고, 2026은 박물관이 새로 만든 틀이다(ADR-0023).
 * 토글 메커니즘은 ADR-0005, 색공간은 ADR-0006, 2001 시기는 ADR-0019 참조.
 */

/** In the era buttons' order: ERA 2026 · 2014 · 2003 · 2001. */
export const ERAS = ["2026", "2014", "2003", "2001"] as const;

export type Era = (typeof ERAS)[number];

/** 첫 방문자에게 노출할 기본 시기 (ADR-0001). */
export const DEFAULT_ERA: Era = "2014";

/** 사용자 선호를 영속화할 localStorage 키. */
export const ERA_STORAGE_KEY = "forg.era";

/** 첫 방문 안내(`<EraHint>`)를 이미 보였다는 표시의 localStorage 키. */
export const ERA_HINT_KEY = "forg.era-hint";

/** 사람이 읽는 시기 라벨 (UI 노출용). */
export const ERA_LABELS: Record<Era, string> = {
  "2026": "2026",
  "2014": "2014",
  "2003": "2003",
  "2001": "2001",
};
