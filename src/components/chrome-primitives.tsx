/**
 * Pieces the 2014 and 2003 frames share: their headers were the same
 * 680px table (logo cell, #FFC73B login bar, 4px `t_bar.gif` rule, 580px
 * menu row), drawn with each era's own art. Desktop markup stays as each
 * capture declares it; `ScrollFade` and `MobileMenu` are the museum's own
 * additions for narrow screens.
 */

import type { ReactNode } from "react";

import { LazyImg } from "@/components/lazy-img";
import { chromeUrl, tileStyle } from "@/lib/chrome";
import type { Era } from "@/lib/era";

/** The 10px slate rail left of the sidebar. */
export function LeftRail() {
  return <div className="bg-forg-slate hidden w-[10px] shrink-0 min-[800px]:block" />;
}

/** The 7px rail right of the content column, tiled with the 2014 `right_bg.gif` in both eras. */
export function RightRail() {
  return (
    <div
      className="bg-forg-slate hidden w-[7px] shrink-0 min-[800px]:block"
      style={tileStyle(chromeUrl("right_bg.gif", "2014"), "repeat")}
    />
  );
}

/**
 * The #FFC73B login bar of the 2014 and 2003 headers: Login and Sign Up,
 * recovered and deliberately not wired up.
 */
export function LoginBar({ era, height }: { era: Era; height: number }) {
  return (
    <div className="bg-forg-gold flex h-[18px] items-center justify-end gap-[2px] px-2">
      <InertChrome
        era={era}
        asset="t_login.gif"
        label="Login"
        title="박물관 모드 — 로그인 비활성"
        height={height}
      />
      <InertChrome
        era={era}
        asset="t_sign.gif"
        label="Sign Up"
        title="박물관 모드 — 회원가입 비활성"
        height={height}
      />
    </div>
  );
}

/**
 * A recovered login/sign-up button the museum deliberately does not wire up.
 * 70 wide; the height is the era's own (`<img height=15>` in 2014, 18 in
 * frame-top-2003, whose art is taller).
 */
function InertChrome({
  era,
  asset,
  label,
  title,
  height,
}: {
  era: Era;
  asset: string;
  label: string;
  title: string;
  height: number;
}) {
  return (
    <LazyImg
      src={chromeUrl(asset, era)}
      alt={label}
      title={title}
      width={70}
      height={height}
      className="block"
    />
  );
}

/** The 4px `t_bar.gif` rule under the login bar (`<td height="4px">`). */
export function TBarRow({ era }: { era: Era }) {
  return (
    <div
      className="bg-forg-gold h-[4px] w-full"
      style={tileStyle(chromeUrl("t_bar.gif", era), "repeat-x")}
    />
  );
}

/**
 * The 580px menu row. `contain:paint`: without it mobile Chrome still sized
 * the page to the row's 580px of buttons, scroller or not.
 */
export function MenuRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="relative min-w-0">
      <nav
        aria-label={label}
        className="bg-forg-menu flex h-[20px] scrollbar-none items-center overflow-x-auto overflow-y-hidden [contain:paint]"
      >
        {children}
      </nav>
      <ScrollFade />
    </div>
  );
}

/**
 * On a screen narrower than the 580px menu row, a fade on its right edge says
 * the row scrolls. Not part of the original, which never met a phone.
 */
function ScrollFade() {
  return (
    <span
      aria-hidden
      className="from-forg-menu pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent min-[680px]:hidden"
    />
  );
}

/**
 * Below 800px the sidebar is gone; its links fold into a "메뉴" bar under the
 * header, in the sidebar's own colours. A `<details>`, so it works without
 * JavaScript. The museum's own addition — forg had no mobile layout.
 */
export function MobileMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group bg-(--era-sidebar-bg) text-(--era-sidebar-fg) min-[800px]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[13px] font-bold [&::-webkit-details-marker]:hidden">
        <span>메뉴 · {label}</span>
        <span aria-hidden className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="grid grid-cols-2 gap-x-4 px-3 pb-3 text-[13px] text-(--era-sidebar-link)">
        {children}
      </div>
    </details>
  );
}

/**
 * A sidebar jump menu (`<select onchange="namosw_goto_byselect(…)">`) to
 * friend sites that have all been gone for years: the same control, with
 * nothing behind it, the way Login and Sign Up are inert. `options` are in
 * the capture's order; `null` is a `---------` divider. `disabled` takes the
 * control out of the tab order, so `note` repeats the names and why they are
 * dead for screen readers.
 */
export function InertJumpMenu({
  id,
  label,
  options,
  note,
  className,
}: {
  id: string;
  label: string;
  options: readonly (string | null)[];
  note: ReactNode;
  className: string;
}) {
  return (
    <>
      <span id={id} className="sr-only">
        {note}
      </span>
      <select
        aria-label={label}
        aria-describedby={id}
        title="박물관 모드 — 연결된 사이트가 모두 사라졌습니다"
        disabled
        defaultValue={options[0] ?? undefined}
        className={className}
      >
        {options.map((option, i) =>
          option === null ? (
            <option key={i} disabled>
              ---------
            </option>
          ) : (
            <option key={i}>{option}</option>
          ),
        )}
      </select>
    </>
  );
}
