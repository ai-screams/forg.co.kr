#!/usr/bin/env python3
"""ETL helper — recover forg.co.kr chrome assets via single-URL Wayback CDX probes.

ADR-0010's Phase C prefix CDX query returned 0 rows for `forg.co.kr/images/`,
`/skin/`, `_zb/images/`, and `_zb/skin/`. A targeted single-URL probe shows
the picture is more nuanced: Wayback has captured **some** files in those
prefixes (left_logo1.gif, t_bar.gif) — they just don't surface via prefix
matching. This script walks the chrome inventory documented in
.docs/research/FORG-RECONSTRUCTION-GUIDE.md and recovers what's available.

Inputs:
    None — the CHROME_TARGETS list below is the source of truth.

Outputs:
    public/img/chrome/{path-segment-flattened}.gif    recovered binary
    public/img/chrome/.manifest.json                  flat sidecar:
        [{originalPath, filename, capturedAt, sizeBytes, sha256}]
    .docs/research/cdx/.chrome-recovery-report.json   stats sidecar (gitignored)

Polite policy: same fcntl.flock global slot as Phase D. Even if both run
side-by-side, Wayback sees one in-flight request total.

Re-runs are idempotent — files already on disk + non-empty are skipped.
The single-URL CDX probe picks the latest valid `image/*` capture in its
window, which defaults to 1999-2015 (forg's active years).

`--era 2003` / `--era 2014` bound that window to one decade and write into
`public/img/chrome/<era>/`. Without it the newest capture wins, which dresses
the 2003 exhibit in later artwork wherever a filename's art changed —
`t_b_kal.gif` read "Kal Ort Por" in 2003 and "Hot Link" by 2007.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent))
from etl_io import write_atomic  # noqa: E402
from wayback_client import (  # noqa: E402
    WaybackError,
    WaybackGoneError,
    fetch_with_retry,
    global_polite_slot,
    local_cdx_rows,
    wayback_url,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
OUT_DIR = PROJECT_ROOT / "public" / "img" / "chrome"
MANIFEST_FILE = OUT_DIR / ".manifest.json"
REPORT_FILE = PROJECT_ROOT / ".docs" / "research" / "cdx" / ".chrome-recovery-report.json"

CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx"

DEFAULT_FROM = "19990101000000"
DEFAULT_TO = "20151231235959"

# Overridden by --era in main().
FROM_TS = DEFAULT_FROM
TO_TS = DEFAULT_TO

# Era windows. The CDX probe picks the *latest* capture inside its window, so
# an unbounded window dresses the 2003 exhibit in 2007 and 2014 artwork: the
# same filename held different art over the years. `t_b_kal.gif` read
# "Kal Ort Por" in 2003 and "Hot Link" by 2007; `r_screen.gif` read
# "BestScreenShot" in 2003 and "Last Expansion Pack" later. Bounding the
# window per era, into its own directory, keeps each exhibit in its own decade.
ERA_WINDOWS: dict[str, tuple[str, str]] = {
    "2003": ("19990101000000", "20041231235959"),
    "2014": ("20110101000000", "20151231235959"),
}


# Each target: (originalPath, savedFilename). originalPath is the
# server-relative URL we ask Wayback for. savedFilename is what we drop
# into public/img/chrome/. We flatten the structure so the 2014 main
# page can refer to assets with a single base path.
CHROME_TARGETS: list[tuple[str, str]] = [
    # ── Brand / sidebar background ──────────────────────────────────────
    ("/images/left_logo1.gif",        "left_logo1.gif"),
    ("/images/l_forg_logo.gif",       "l_forg_logo.gif"),
    ("/images/left_background.gif",   "left_background.gif"),
    ("/images/left_bg.gif",           "left_bg.gif"),
    # ── Accent rules ────────────────────────────────────────────────────
    ("/images/t_bar.gif",             "t_bar.gif"),
    ("/images/t_line.gif",            "t_line.gif"),
    ("/images/m_bar.gif",             "m_bar.gif"),
    ("/images/m_bar_logo.gif",        "m_bar_logo.gif"),
    ("/images/m_bar_b_1.gif",         "m_bar_b_1.gif"),
    ("/images/m_line.gif",            "m_line.gif"),
    ("/images/m_line_l.gif",          "m_line_l.gif"),
    ("/images/m_line_r.gif",          "m_line_r.gif"),
    # ── Login / signup ──────────────────────────────────────────────────
    ("/images/t_login.gif",           "t_login.gif"),
    ("/images/t_login_1.gif",         "t_login_1.gif"),
    ("/images/t_sign.gif",            "t_sign.gif"),
    ("/images/t_sign_1.gif",          "t_sign_1.gif"),
    # ── 2014 7-button top menu (with hover variants) ────────────────────
    ("/images/t_b_freeboard.gif",     "t_b_freeboard.gif"),
    ("/images/t_b_freeboard_1.gif",   "t_b_freeboard_1.gif"),
    ("/images/t_b_photo.gif",         "t_b_photo.gif"),
    ("/images/t_b_photo_1.gif",       "t_b_photo_1.gif"),
    ("/images/t_b_fun.gif",           "t_b_fun.gif"),
    ("/images/t_b_fun_1.gif",         "t_b_fun_1.gif"),
    ("/images/t_b_movie.gif",         "t_b_movie.gif"),
    ("/images/t_b_movie_1.gif",       "t_b_movie_1.gif"),
    ("/images/t_b_boo.gif",           "t_b_boo.gif"),
    ("/images/t_b_boo_1.gif",         "t_b_boo_1.gif"),
    ("/images/t_b_tra.gif",           "t_b_tra.gif"),
    ("/images/t_b_tra_1.gif",         "t_b_tra_1.gif"),
    ("/images/t_b_trash.gif",         "t_b_trash.gif"),
    ("/images/t_b_trash_1.gif",       "t_b_trash_1.gif"),
    # ── 2003 8-button top menu (kept for the 2003 toggle later) ─────────
    ("/images/t_b_question.gif",      "t_b_question.gif"),
    ("/images/t_b_question_1.gif",    "t_b_question_1.gif"),
    ("/images/t_b_roleplay.gif",      "t_b_roleplay.gif"),
    ("/images/t_b_roleplay_1.gif",    "t_b_roleplay_1.gif"),
    ("/images/t_b_essay.gif",         "t_b_essay.gif"),
    ("/images/t_b_essay_1.gif",       "t_b_essay_1.gif"),
    ("/images/t_b_screenshot.gif",    "t_b_screenshot.gif"),
    ("/images/t_b_screenshot_1.gif",  "t_b_screenshot_1.gif"),
    ("/images/t_b_kal.gif",           "t_b_kal.gif"),
    ("/images/t_b_kal_1.gif",         "t_b_kal_1.gif"),
    ("/images/t_hi.gif",              "t_hi.gif"),
    ("/images/t_hi_1.gif",            "t_hi_1.gif"),
    ("/images/t_b_right.gif",         "t_b_right.gif"),
    # ── Sidebar section headers (2003 frameset era) ─────────────────────
    ("/images/m_info.gif",            "m_info.gif"),
    ("/images/m_co.gif",              "m_co.gif"),
    ("/images/m_remember.gif",        "m_remember.gif"),
    ("/images/m_forg.gif",            "m_forg.gif"),
    ("/images/m_friend.gif",          "m_friend.gif"),
    # ── Main content section headers ────────────────────────────────────
    ("/images/m_notice.gif",          "m_notice.gif"),
    ("/images/m_role.gif",            "m_role.gif"),
    ("/images/m_column.gif",          "m_column.gif"),
    # ── Right sidebar headers ───────────────────────────────────────────
    ("/images/r_freeboard.gif",       "r_freeboard.gif"),
    ("/images/r_role.gif",            "r_role.gif"),
    ("/images/r_essay.gif",           "r_essay.gif"),
    ("/images/r_screen.gif",          "r_screen.gif"),
    # ── 6-box main grid headers ─────────────────────────────────────────
    *(
        (f"/images/main_list_{i}.gif", f"main_list_{i}.gif")
        for i in range(1, 9)
    ),
    # ── Counter / footer ────────────────────────────────────────────────
    ("/images/bgm_bg.gif",            "bgm_bg.gif"),
    ("/images/bgm_right.gif",         "bgm_right.gif"),
    # ── Decorative arrows / spacers ─────────────────────────────────────
    ("/images/a.gif",                 "a.gif"),
    ("/images/menu_arrow.gif",        "menu_arrow.gif"),
    ("/images/menu_arrow_1.gif",      "menu_arrow_1.gif"),
    ("/images/menu_arrow_2.gif",      "menu_arrow_2.gif"),
    # ── Latest-list skin icons ──────────────────────────────────────────
    ("/skin/latest/last_forg/img/icon_link.gif",  "skin_icon_link.gif"),
    ("/skin/latest/last_forg/img/icon_hot.gif",   "skin_icon_hot.gif"),
    ("/skin/latest/last_forg/img/icon_file.gif",  "skin_icon_file.gif"),
    ("/skin/latest/last_forg/img/icon_reply.gif", "skin_icon_reply.gif"),
    # ── Second pass (2026-09-18) ────────────────────────────────────────
    # Diffing every image referenced by .docs/research/snapshots/*.html
    # against this list found 51 assets that had never been probed at all —
    # a gap in the inventory, not a Wayback miss. The board-skin block is
    # what the board-list pages need to look like the original rather than
    # an approximation. Paths outside /images/ keep a source-marking prefix
    # so flattened filenames cannot collide (e.g. /images/t.gif vs
    # /_zb/images/t.gif).
    # Zeroboard 4.1 `kritz_normal2` board skin (uoboard-2007, notice-2007)
    ("/_zb/skin/kritz_normal2/title_name.gif",   "zb_kritz_title_name.gif"),
    ("/_zb/skin/kritz_normal2/title_title.gif",  "zb_kritz_title_title.gif"),
    ("/_zb/skin/kritz_normal2/title_date.gif",   "zb_kritz_title_date.gif"),
    ("/_zb/skin/kritz_normal2/title_hit.gif",    "zb_kritz_title_hit.gif"),
    ("/_zb/skin/kritz_normal2/title_icon.gif",   "zb_kritz_title_icon.gif"),
    ("/_zb/skin/kritz_normal2/list_notice.gif",  "zb_kritz_list_notice.gif"),
    ("/_zb/skin/kritz_normal2/new_head.gif",     "zb_kritz_new_head.gif"),
    ("/_zb/skin/kritz_normal2/old_head.gif",     "zb_kritz_old_head.gif"),
    ("/_zb/skin/kritz_normal2/subject_on.gif",   "zb_kritz_subject_on.gif"),
    ("/_zb/skin/kritz_normal2/name_off.gif",     "zb_kritz_name_off.gif"),
    ("/_zb/skin/kritz_normal2/content_on.gif",   "zb_kritz_content_on.gif"),
    ("/_zb/skin/kritz_normal2/level1_write.gif", "zb_kritz_level1_write.gif"),
    ("/_zb/skin/kritz_normal2/level2_write.gif", "zb_kritz_level2_write.gif"),
    ("/_zb/skin/kritz_normal2/images/search_left.gif",   "zb_kritz_search_left.gif"),
    ("/_zb/skin/kritz_normal2/images/search_right.gif",  "zb_kritz_search_right.gif"),
    ("/_zb/skin/kritz_normal2/images/search_right2.gif", "zb_kritz_search_right2.gif"),
    ("/_zb/images/t.gif",                        "zb_t.gif"),
    # 2014 sidebar rules + right column, referenced by 2014-12-18.html
    ("/images/l_bar.gif",                        "l_bar.gif"),
    ("/images/blank_l_line.gif",                 "blank_l_line.gif"),
    ("/images/right_bg.gif",                     "right_bg.gif"),
    # 2014 login box skin (inert in the museum, but part of the header art)
    ("/skin/outlogin/forg/img/btn_register.gif",        "outlogin_btn_register.gif"),
    ("/skin/outlogin/forg/img/btn_password_forget.gif", "outlogin_btn_password_forget.gif"),
    ("/skin/outlogin/forg/img/close.gif",               "outlogin_close.gif"),
    ("/skin/outlogin/forg/img/icon.gif",                "outlogin_icon.gif"),
    # 2003 / 2007 front page furniture
    ("/best_22.gif",                             "best_22.gif"),
    # 2004-11-30 capture: the same box, a later screenshot (snapshot-2004-11-30.md)
    ("/best_55.gif",                             "best_55.gif"),
    ("/UObox_1.gif",                             "UObox_1.gif"),
    ("/count.gif",                               "count.gif"),
    ("/bgm/en.gif",                              "bgm_en.gif"),
    ("/bgm/ser.gif",                             "bgm_ser.gif"),
    ("/images/left_logo.gif",                    "left_logo.gif"),
    ("/images/r_bar.gif",                        "r_bar.gif"),
    ("/images/5px.gif",                          "5px.gif"),
    ("/images/t.gif",                            "t.gif"),
    ("/images/_cl.gif",                          "_cl.gif"),
    ("/images/new.gif",                          "new.gif"),
    ("/images/notice_logo.gif",                  "notice_logo.gif"),
    ("/images/forg_main_logo_4.gif",             "forg_main_logo_4.gif"),
    # 2003 bottom frame served its strip from /bgm/, not /images/
    ("/bgm/bgm_bg.gif",                          "bgm_bg.gif"),
    ("/bgm/bgm_right.gif",                       "bgm_right.gif"),
    # frame-main-2003 loaded these from a second host. Same filenames as
    # the forg.co.kr copies, so in the flat pool the first probe to land
    # wins; in the 2003 era pool they are the 2003 art.
    ("http://hosting27.interpia98.net/~forg/images/m_middle_logo.gif",    "m_middle_logo.gif"),
    ("http://hosting27.interpia98.net/~forg/images/r_logo_1.gif",         "r_logo_1.gif"),
    ("http://hosting27.interpia98.net/~forg/images/logo_bottom.gif",      "logo_bottom.gif"),
    ("http://hosting27.interpia98.net/~forg/images/forg_main_logo_1.gif", "forg_main_logo_1.gif"),
    ("http://hosting27.interpia98.net/~forg/images/r_bar_b.gif",          "r_bar_b.gif"),
    ("http://hosting27.interpia98.net/~forg/images/m_bar_logo.gif",       "m_bar_logo.gif"),
    ("http://hosting27.interpia98.net/~forg/images/m_notice.gif",         "m_notice.gif"),
    ("http://hosting27.interpia98.net/~forg/images/m_role.gif",           "m_role.gif"),
    ("http://hosting27.interpia98.net/~forg/images/m_column.gif",         "m_column.gif"),
    ("http://hosting27.interpia98.net/~forg/images/r_freeboard.gif",      "r_freeboard.gif"),
    ("http://hosting27.interpia98.net/~forg/images/r_role.gif",           "r_role.gif"),
    ("http://hosting27.interpia98.net/~forg/images/r_essay.gif",          "r_essay.gif"),
    ("http://hosting27.interpia98.net/~forg/images/r_screen.gif",         "r_screen.gif"),
    # Newbie guide art (skill_newbie), referenced by newbie-guide.html
    ("/skill_newbie/images/main_dragon.gif",        "newbie_main_dragon.gif"),
    ("/skill_newbie/images/forg_background.gif",    "newbie_forg_background.gif"),
    ("/skill_newbie/images/alpha_background.gif",   "newbie_alpha_background.gif"),
    ("/skill_newbie/images/alpha_background_1.gif", "newbie_alpha_background_1.gif"),
    ("/skill_newbie/images/b_logo.gif",             "newbie_b_logo.gif"),
    ("/skill_newbie/images/ball.gif",               "newbie_ball.gif"),
    ("/skill_newbie/images/g.gif",                  "newbie_g.gif"),
    ("/skill_newbie/images/memo_t.gif",             "newbie_memo_t.gif"),
    ("/skill_newbie/images/memo_m.gif",             "newbie_memo_m.gif"),
    ("/skill_newbie/images/memo_b.gif",             "newbie_memo_b.gif"),
    ("/skill_newbie/images/menu.gif",               "newbie_menu.gif"),
    ("/skill_newbie/images/top.gif",                "newbie_top.gif"),
    # ── Third pass (2026-09-20) ─────────────────────────────────────────
    # The collection audit found `cdx/site-images.json` — a full CDX answer
    # for /images/ saved on 2026-05-02 — that no stage had ever read. 99 of
    # its 167 paths were not on this list. They are registered so the pool
    # is the inventory, not a guess; `cdx_probe` answers them from the local
    # index, so each costs one download and no CDX request.
    # Board header logos (2002–2004 board pages)
    ("/images/buy_logo.gif",                    "buy_logo.gif"),
    ("/images/essay_logo.gif",                  "essay_logo.gif"),
    ("/images/event_logo.gif",                  "event_logo.gif"),
    ("/images/fun_logo.gif",                    "fun_logo.gif"),
    ("/images/question_logo.gif",               "question_logo.gif"),
    ("/images/role_logo.gif",                   "role_logo.gif"),
    ("/images/screenshot_logo.gif",             "screenshot_logo.gif"),
    ("/images/trash_logo.gif",                  "trash_logo.gif"),
    # 2013–2014 front page: 8-box list titles, social icons, title strip
    ("/images/FB6.png",                         "FB6.png"),
    ("/images/icon_twitter.png",                "icon_twitter.png"),
    ("/images/main_list_1.gif",                 "main_list_1.gif"),
    ("/images/main_list_2.gif",                 "main_list_2.gif"),
    ("/images/main_list_3.gif",                 "main_list_3.gif"),
    ("/images/main_list_4.gif",                 "main_list_4.gif"),
    ("/images/main_list_5.gif",                 "main_list_5.gif"),
    ("/images/main_list_6.gif",                 "main_list_6.gif"),
    ("/images/main_list_7.gif",                 "main_list_7.gif"),
    ("/images/main_list_8.gif",                 "main_list_8.gif"),
    ("/images/me2day_icon.PNG",                 "me2day_icon.PNG"),
    ("/images/title_bg.jpg",                    "title_bg.jpg"),
    # 2005–2006 WoW-era sidebar and headers
    ("/images/all_1.jpg",                       "all_1.jpg"),
    ("/images/count.gif",                       "count.gif"),
    ("/images/m_column_1.gif",                  "m_column_1.gif"),
    ("/images/m_middle_wowlogo.gif",            "m_middle_wowlogo.gif"),
    ("/images/m_onews.gif",                     "m_onews.gif"),
    ("/images/m_wownotice.gif",                 "m_wownotice.gif"),
    ("/images/m_wowrole.gif",                   "m_wowrole.gif"),
    ("/images/main_logo_forg.gif",              "main_logo_forg.gif"),
    ("/images/r_bar_l.gif",                     "r_bar_l.gif"),
    ("/images/r_bar_l_2.gif",                   "r_bar_l_2.gif"),
    ("/images/r_wowessay.gif",                  "r_wowessay.gif"),
    ("/images/r_wowfreeboard.gif",              "r_wowfreeboard.gif"),
    ("/images/r_wowrole.gif",                   "r_wowrole.gif"),
    ("/images/r_wowscreen.gif",                 "r_wowscreen.gif"),
    ("/images/right_background.gif",            "right_background.gif"),
    ("/images/right_background_1.gif",          "right_background_1.gif"),
    ("/images/t_wowhi.gif",                     "t_wowhi.gif"),
    ("/images/wow_1.gif",                       "wow_1.gif"),
    ("/images/zoombox_background.gif",          "zoombox_background.gif"),
    # 2001 menu set (a pre-2003 layout, kept for a future era)
    ("/images/e.gif",                           "e.gif"),
    ("/images/holy.gif",                        "holy.gif"),
    ("/images/m_b.gif",                         "m_b.gif"),
    ("/images/m_c.gif",                         "m_c.gif"),
    ("/images/m_e.gif",                         "m_e.gif"),
    ("/images/m_f.gif",                         "m_f.gif"),
    ("/images/m_fun.gif",                       "m_fun.gif"),
    ("/images/m_j.gif",                         "m_j.gif"),
    ("/images/m_k.gif",                         "m_k.gif"),
    ("/images/m_m.gif",                         "m_m.gif"),
    ("/images/m_map.gif",                       "m_map.gif"),
    ("/images/m_n.gif",                         "m_n.gif"),
    ("/images/m_q.gif",                         "m_q.gif"),
    ("/images/m_r.gif",                         "m_r.gif"),
    ("/images/m_s.gif",                         "m_s.gif"),
    ("/images/sasa.gif",                        "sasa.gif"),
    ("/images/t_l.gif",                         "t_l.gif"),
    ("/images/t_r.gif",                         "t_r.gif"),
    ("/images/team.gif",                        "team.gif"),
    ("/images/trophy.gif",                      "trophy.gif"),
    # /images/mail/ — the mail/FAQ page
    ("/images/mail/zoombox_background.gif",     "mail_zoombox_background.gif"),
    ("/images/mail/title_bg.jpg",               "mail_title_bg.jpg"),
    ("/images/mail/b_logo.gif",                 "mail_b_logo.gif"),
    ("/images/mail/faq_1.gif",                  "mail_faq_1.gif"),
    ("/images/mail/faq_2.gif",                  "mail_faq_2.gif"),
    ("/images/mail/faq_3.gif",                  "mail_faq_3.gif"),
    ("/images/mail/faq_4.gif",                  "mail_faq_4.gif"),
    ("/images/mail/faq_5.gif",                  "mail_faq_5.gif"),
    ("/images/mail/forg_dragon.gif",            "mail_forg_dragon.gif"),
    ("/images/mail/level1_write.gif",           "mail_level1_write.gif"),
    ("/images/mail/line.gif",                   "mail_line.gif"),
    ("/images/mail/t_b_right.gif",              "mail_t_b_right.gif"),
    # 2002–2007 front page and board furniture, by year of capture
    ("/images/all.jpg",                         "all.jpg"),
    ("/images/alsee_1.gif",                     "alsee_1.gif"),
    ("/images/alsee_2.gif",                     "alsee_2.gif"),
    ("/images/alsee_3.gif",                     "alsee_3.gif"),
    ("/images/aos_box.gif",                     "aos_box.gif"),
    ("/images/box_3.gif",                       "box_3.gif"),
    ("/images/cool_logo_1.gif",                 "cool_logo_1.gif"),
    ("/images/en.gif",                          "en.gif"),
    ("/images/forg_main_logo_1.gif",            "forg_main_logo_1.gif"),
    ("/images/i_talks_big.gif",                 "i_talks_big.gif"),
    ("/images/loading.gif",                     "loading.gif"),
    ("/images/logo_bottom.gif",                 "logo_bottom.gif"),
    ("/images/m_middle_logo.gif",               "m_middle_logo.gif"),
    ("/images/mabinogi.gif",                    "mabinogi.gif"),
    ("/images/nb.gif",                          "nb.gif"),
    ("/images/newbiefaq.gif",                   "newbiefaq.gif"),
    ("/images/nr.gif",                          "nr.gif"),
    ("/images/r_bar_b.gif",                     "r_bar_b.gif"),
    ("/images/r_logo_1.gif",                    "r_logo_1.gif"),
    ("/images/r_logo_2.gif",                    "r_logo_2.gif"),
    ("/images/ser.gif",                         "ser.gif"),
    ("/images/sun.gif",                         "sun.gif"),
    ("/images/t_b_buy.gif",                     "t_b_buy.gif"),
    ("/images/t_b_buy_1.gif",                   "t_b_buy_1.gif"),
    ("/images/t_pod_1.gif",                     "t_pod_1.gif"),
    ("/images/tree_1.gif",                      "tree_1.gif"),
    ("/images/uo_1.gif",                        "uo_1.gif"),
    ("/images/uof.gif",                         "uof.gif"),
    # ── Fourth pass (2026-09-23) ────────────────────────────────────────
    # Every `skin/**` image the 707 board-list captures under
    # `.docs/research/archive/L/` actually render, which no pass had read.
    # The board list is the one page shape the museum draws from data rather
    # than from a snapshot, so its skin art is what the listing needs to stop
    # being an approximation. Generated from the captures, not typed: strip
    # `<!-- -->` first (`title_bs.gif`, `last.gif` and `member_memo_off.gif`
    # appear only inside comments and are left out for that reason), then
    # drop the per-board search box and member strip — Zeroboard's
    # `images/search_*` and `images/setup_*`, Gnuboard's `btn_search.gif`:
    # the museum's search is site-wide, not per board.
    # Trailing numbers are reference occurrences / distinct captures.
    # Zeroboard `kritz_normal` — the list skin 381 captures wear, absent here until now
    ("/_zb/skin/kritz_normal/old_head.gif",         "zb_kritzn_old_head.gif"),  # 7282 / 379
    ("/_zb/skin/kritz_normal/content_on.gif",       "zb_kritzn_content_on.gif"),  # 762 / 381
    ("/_zb/skin/kritz_normal/name_off.gif",         "zb_kritzn_name_off.gif"),  # 762 / 381
    ("/_zb/skin/kritz_normal/subject_on.gif",       "zb_kritzn_subject_on.gif"),  # 762 / 381
    ("/_zb/skin/kritz_normal/title_bg.jpg",         "zb_kritzn_title_bg.jpg"),  # 384 / 384
    ("/_zb/skin/kritz_normal/content_off.gif",      "zb_kritzn_content_off.gif"),  # 381 / 381
    ("/_zb/skin/kritz_normal/name_on.gif",          "zb_kritzn_name_on.gif"),  # 381 / 381
    ("/_zb/skin/kritz_normal/subject_off.gif",      "zb_kritzn_subject_off.gif"),  # 381 / 381
    ("/_zb/skin/kritz_normal/title_date.gif",       "zb_kritzn_title_date.gif"),  # 381 / 381
    ("/_zb/skin/kritz_normal/title_hit.gif",        "zb_kritzn_title_hit.gif"),  # 381 / 381
    ("/_zb/skin/kritz_normal/title_icon.gif",       "zb_kritzn_title_icon.gif"),  # 381 / 381
    ("/_zb/skin/kritz_normal/title_name.gif",       "zb_kritzn_title_name.gif"),  # 381 / 381
    ("/_zb/skin/kritz_normal/title_title.gif",      "zb_kritzn_title_title.gif"),  # 381 / 381
    ("/_zb/skin/kritz_normal/level3_write.gif",     "zb_kritzn_level3_write.gif"),  # 164 / 96
    ("/_zb/skin/kritz_normal/level5_write.gif",     "zb_kritzn_level5_write.gif"),  # 154 / 93
    ("/_zb/skin/kritz_normal/level4_write.gif",     "zb_kritzn_level4_write.gif"),  # 150 / 76
    ("/_zb/skin/kritz_normal/level2_write.gif",     "zb_kritzn_level2_write.gif"),  # 86 / 58
    ("/_zb/skin/kritz_normal/reply_head.gif",       "zb_kritzn_reply_head.gif"),  # 56 / 16
    ("/_zb/skin/kritz_normal/level1_write.gif",     "zb_kritzn_level1_write.gif"),  # 49 / 26
    ("/_zb/skin/kritz_normal/new_head.gif",         "zb_kritzn_new_head.gif"),  # 20 / 3
    ("/_zb/skin/kritz_normal/list_notice.gif",      "zb_kritzn_list_notice.gif"),  # 14 / 6
    ("/_zb/skin/kritz_normal/secret_head.gif",      "zb_kritzn_secret_head.gif"),  # 1 / 1
    # `kritz_normal2` — the rest of what its list pages draw
    ("/_zb/skin/kritz_normal2/title_bg.jpg",         "zb_kritz_title_bg.jpg"),  # 191 / 191
    ("/_zb/skin/kritz_normal2/content_off.gif",      "zb_kritz_content_off.gif"),  # 186 / 186
    ("/_zb/skin/kritz_normal2/name_on.gif",          "zb_kritz_name_on.gif"),  # 186 / 186
    ("/_zb/skin/kritz_normal2/subject_off.gif",      "zb_kritz_subject_off.gif"),  # 186 / 186
    ("/_zb/skin/kritz_normal2/level3_write.gif",     "zb_kritz_level3_write.gif"),  # 164 / 34
    ("/_zb/skin/kritz_normal2/level4_write.gif",     "zb_kritz_level4_write.gif"),  # 122 / 29
    ("/_zb/skin/kritz_normal2/level5_write.gif",     "zb_kritz_level5_write.gif"),  # 30 / 23
    ("/_zb/skin/kritz_normal2/reply_head.gif",       "zb_kritz_reply_head.gif"),  # 14 / 4
    ("/_zb/skin/kritz_normal2/poll.gif",             "zb_kritz_poll.gif"),  # 5 / 4
    # `kritz_wysiwyg` (60 captures)
    ("/_zb/skin/kritz_wysiwyg/old_head.gif",         "zb_kritzw_old_head.gif"),  # 934 / 50
    ("/_zb/skin/kritz_wysiwyg/content_on.gif",       "zb_kritzw_content_on.gif"),  # 120 / 60
    ("/_zb/skin/kritz_wysiwyg/name_off.gif",         "zb_kritzw_name_off.gif"),  # 120 / 60
    ("/_zb/skin/kritz_wysiwyg/subject_on.gif",       "zb_kritzw_subject_on.gif"),  # 120 / 60
    ("/_zb/skin/kritz_wysiwyg/level1_write.gif",     "zb_kritzw_level1_write.gif"),  # 116 / 12
    ("/_zb/skin/kritz_wysiwyg/level2_write.gif",     "zb_kritzw_level2_write.gif"),  # 71 / 21
    ("/_zb/skin/kritz_wysiwyg/level3_write.gif",     "zb_kritzw_level3_write.gif"),  # 61 / 20
    ("/_zb/skin/kritz_wysiwyg/content_off.gif",      "zb_kritzw_content_off.gif"),  # 60 / 60
    ("/_zb/skin/kritz_wysiwyg/name_on.gif",          "zb_kritzw_name_on.gif"),  # 60 / 60
    ("/_zb/skin/kritz_wysiwyg/subject_off.gif",      "zb_kritzw_subject_off.gif"),  # 60 / 60
    ("/_zb/skin/kritz_wysiwyg/title_bg.jpg",         "zb_kritzw_title_bg.jpg"),  # 60 / 60
    ("/_zb/skin/kritz_wysiwyg/title_date.gif",       "zb_kritzw_title_date.gif"),  # 60 / 60
    ("/_zb/skin/kritz_wysiwyg/title_hit.gif",        "zb_kritzw_title_hit.gif"),  # 60 / 60
    ("/_zb/skin/kritz_wysiwyg/title_icon.gif",       "zb_kritzw_title_icon.gif"),  # 60 / 60
    ("/_zb/skin/kritz_wysiwyg/title_name.gif",       "zb_kritzw_title_name.gif"),  # 60 / 60
    ("/_zb/skin/kritz_wysiwyg/title_title.gif",      "zb_kritzw_title_title.gif"),  # 60 / 60
    ("/_zb/skin/kritz_wysiwyg/level5_write.gif",     "zb_kritzw_level5_write.gif"),  # 37 / 7
    ("/_zb/skin/kritz_wysiwyg/level4_write.gif",     "zb_kritzw_level4_write.gif"),  # 31 / 12
    # `kritz_trash` (22) — `dmon_icon` is its per-row marker
    ("/_zb/skin/kritz_trash/dmon_icon.gif",       "zb_kritzt_dmon_icon.gif"),  # 494 / 22
    ("/_zb/skin/kritz_trash/content_on.gif",      "zb_kritzt_content_on.gif"),  # 44 / 22
    ("/_zb/skin/kritz_trash/subject_on.gif",      "zb_kritzt_subject_on.gif"),  # 44 / 22
    ("/_zb/skin/kritz_trash/content_off.gif",     "zb_kritzt_content_off.gif"),  # 22 / 22
    ("/_zb/skin/kritz_trash/name_off.gif",        "zb_kritzt_name_off.gif"),  # 22 / 22
    ("/_zb/skin/kritz_trash/name_on.gif",         "zb_kritzt_name_on.gif"),  # 22 / 22
    ("/_zb/skin/kritz_trash/subject_off.gif",     "zb_kritzt_subject_off.gif"),  # 22 / 22
    ("/_zb/skin/kritz_trash/title_bg.jpg",        "zb_kritzt_title_bg.jpg"),  # 22 / 22
    ("/_zb/skin/kritz_trash/title_date.gif",      "zb_kritzt_title_date.gif"),  # 22 / 22
    ("/_zb/skin/kritz_trash/title_hit.gif",       "zb_kritzt_title_hit.gif"),  # 22 / 22
    ("/_zb/skin/kritz_trash/title_icon.gif",      "zb_kritzt_title_icon.gif"),  # 22 / 22
    ("/_zb/skin/kritz_trash/title_name.gif",      "zb_kritzt_title_name.gif"),  # 22 / 22
    ("/_zb/skin/kritz_trash/title_title.gif",     "zb_kritzt_title_title.gif"),  # 22 / 22
    ("/_zb/skin/kritz_trash/list_notice.gif",     "zb_kritzt_list_notice.gif"),  # 10 / 5
    # `kritz_trash2` (1)
    ("/_zb/skin/kritz_trash2/dmon_icon.gif",       "zb_kritzt2_dmon_icon.gif"),  # 21 / 1
    ("/_zb/skin/kritz_trash2/content_on.gif",      "zb_kritzt2_content_on.gif"),  # 2 / 1
    ("/_zb/skin/kritz_trash2/subject_on.gif",      "zb_kritzt2_subject_on.gif"),  # 2 / 1
    ("/_zb/skin/kritz_trash2/content_off.gif",     "zb_kritzt2_content_off.gif"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/list_notice.gif",     "zb_kritzt2_list_notice.gif"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/name_off.gif",        "zb_kritzt2_name_off.gif"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/name_on.gif",         "zb_kritzt2_name_on.gif"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/subject_off.gif",     "zb_kritzt2_subject_off.gif"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/title_bg.jpg",        "zb_kritzt2_title_bg.jpg"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/title_date.gif",      "zb_kritzt2_title_date.gif"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/title_hit.gif",       "zb_kritzt2_title_hit.gif"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/title_icon.gif",      "zb_kritzt2_title_icon.gif"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/title_name.gif",      "zb_kritzt2_title_name.gif"),  # 1 / 1
    ("/_zb/skin/kritz_trash2/title_title.gif",     "zb_kritzt2_title_title.gif"),  # 1 / 1
    # `link` — the Recall board's skin
    ("/_zb/skin/link/4.gif",                       "zb_link_4.gif"),  # 184 / 8
    ("/_zb/skin/link/6.gif",                       "zb_link_6.gif"),  # 184 / 8
    ("/_zb/skin/link/5.gif",                       "zb_link_5.gif"),  # 92 / 8
    ("/_zb/skin/link/images/btn_delete.gif",       "zb_link_btn_delete.gif"),  # 34 / 8
    ("/_zb/skin/link/dot.gif",                     "zb_link_dot.gif"),  # 26 / 7
    ("/_zb/skin/link/images/btn_modify.gif",       "zb_link_btn_modify.gif"),  # 26 / 7
    ("/_zb/skin/link/name_head.gif",               "zb_link_name_head.gif"),  # 26 / 7
    ("/_zb/skin/link/2.gif",                       "zb_link_2.gif"),  # 16 / 8
    ("/_zb/skin/link/8.gif",                       "zb_link_8.gif"),  # 16 / 8
    ("/_zb/skin/link/1.gif",                       "zb_link_1.gif"),  # 8 / 8
    ("/_zb/skin/link/3.gif",                       "zb_link_3.gif"),  # 8 / 8
    ("/_zb/skin/link/7.gif",                       "zb_link_7.gif"),  # 8 / 8
    ("/_zb/skin/link/9.gif",                       "zb_link_9.gif"),  # 8 / 8
    ("/_zb/skin/link/content_off.gif",             "zb_link_content_off.gif"),  # 8 / 8
    ("/_zb/skin/link/content_on.gif",              "zb_link_content_on.gif"),  # 8 / 8
    ("/_zb/skin/link/images/btn_list.gif",         "zb_link_btn_list.gif"),  # 8 / 8
    ("/_zb/skin/link/images/btn_nextpage.gif",     "zb_link_btn_nextpage.gif"),  # 8 / 8
    ("/_zb/skin/link/images/btn_prevpage.gif",     "zb_link_btn_prevpage.gif"),  # 8 / 8
    ("/_zb/skin/link/images/btn_write.gif",        "zb_link_btn_write.gif"),  # 8 / 8
    ("/_zb/skin/link/images/lh_bg.gif",            "zb_link_lh_bg.gif"),  # 8 / 8
    ("/_zb/skin/link/name_off.gif",                "zb_link_name_off.gif"),  # 8 / 8
    ("/_zb/skin/link/name_on.gif",                 "zb_link_name_on.gif"),  # 8 / 8
    ("/_zb/skin/link/subject_off.gif",             "zb_link_subject_off.gif"),  # 8 / 8
    ("/_zb/skin/link/subject_on.gif",              "zb_link_subject_on.gif"),  # 8 / 8
    ("/_zb/skin/link/zip.gif",                     "zb_link_zip.gif"),  # 8 / 2
    # `zetyx_diary_Esee` — the BOD diary boards
    ("/_zb/skin/zetyx_diary_Esee/4.gif",                "zb_diary_4.gif"),  # 84 / 3
    ("/_zb/skin/zetyx_diary_Esee/6.gif",                "zb_diary_6.gif"),  # 84 / 3
    ("/_zb/skin/zetyx_diary_Esee/5.gif",                "zb_diary_5.gif"),  # 42 / 3
    ("/_zb/skin/zetyx_diary_Esee/2.gif",                "zb_diary_2.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/8.gif",                "zb_diary_8.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/content_on.gif",       "zb_diary_content_on.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/dot.gif",              "zb_diary_dot.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/i_delete2.gif",        "zb_diary_i_delete2.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/i_modify2.gif",        "zb_diary_i_modify2.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/name_head.gif",        "zb_diary_name_head.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/name_off.gif",         "zb_diary_name_off.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/subject_on.gif",       "zb_diary_subject_on.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/weather0.gif",         "zb_diary_weather0.gif"),  # 6 / 3
    ("/_zb/skin/zetyx_diary_Esee/1.gif",                "zb_diary_1.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/3.gif",                "zb_diary_3.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/7.gif",                "zb_diary_7.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/9.gif",                "zb_diary_9.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/content_off.gif",      "zb_diary_content_off.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/i_delete.gif",         "zb_diary_i_delete.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/i_list.gif",           "zb_diary_i_list.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/i_next.gif",           "zb_diary_i_next.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/i_prev.gif",           "zb_diary_i_prev.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/i_write.gif",          "zb_diary_i_write.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/images/lh_bg.gif",     "zb_diary_lh_bg.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/name_on.gif",          "zb_diary_name_on.gif"),  # 3 / 3
    ("/_zb/skin/zetyx_diary_Esee/subject_off.gif",      "zb_diary_subject_off.gif"),  # 3 / 3
    # `buzzard` — the events_date calendar
    ("/_zb/skin/buzzard/content_off.gif",        "zb_buzzard_content_off.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/content_on.gif",         "zb_buzzard_content_on.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/date_top.gif",           "zb_buzzard_date_top.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/date_top_left.gif",      "zb_buzzard_date_top_left.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/date_top_right.gif",     "zb_buzzard_date_top_right.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/name_off.gif",           "zb_buzzard_name_off.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/name_on.gif",            "zb_buzzard_name_on.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/salvia_01.gif",          "zb_buzzard_salvia_01.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/salvia_02.gif",          "zb_buzzard_salvia_02.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/salvia_03.gif",          "zb_buzzard_salvia_03.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/salvia_04.gif",          "zb_buzzard_salvia_04.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/salvia_05.gif",          "zb_buzzard_salvia_05.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/salvia_06.gif",          "zb_buzzard_salvia_06.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/salvia_07.gif",          "zb_buzzard_salvia_07.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/subject_off.gif",        "zb_buzzard_subject_off.gif"),  # 1 / 1
    ("/_zb/skin/buzzard/subject_on.gif",         "zb_buzzard_subject_on.gif"),  # 1 / 1
    # Gnuboard5 `webbus2009_basic` — the 2014 list skin; its row icons are a different set from the front page's `skin/latest/last_forg`
    ("/skin/board/webbus2009_basic/img/icon_hot.gif",         "gb_icon_hot.gif"),  # 157 / 10
    ("/skin/board/webbus2009_basic/img/icon_file.gif",        "gb_icon_file.gif"),  # 82 / 11
    ("/skin/board/webbus2009_basic/img/page_end.gif",         "gb_page_end.gif"),  # 13 / 13
    ("/skin/board/webbus2009_basic/img/title_bg.gif",         "gb_title_bg.gif"),  # 13 / 13
    ("/skin/board/webbus2009_basic/img/title_shadow.gif",     "gb_title_shadow.gif"),  # 13 / 13
    ("/skin/board/webbus2009_basic/img/w_1.gif",              "gb_w_1.gif"),  # 13 / 13
    ("/skin/board/webbus2009_basic/img/w_2.gif",              "gb_w_2.gif"),  # 13 / 13
    ("/skin/board/webbus2009_basic/img/w_3.gif",              "gb_w_3.gif"),  # 13 / 13
    ("/skin/board/webbus2009_basic/img/w_4.gif",              "gb_w_4.gif"),  # 13 / 13
    ("/skin/board/webbus2009_basic/img/w_5.gif",              "gb_w_5.gif"),  # 13 / 13
    ("/skin/board/webbus2009_basic/img/icon_link.gif",        "gb_icon_link.gif"),  # 10 / 4
    ("/skin/board/webbus2009_basic/img/page_next.gif",        "gb_page_next.gif"),  # 9 / 9
    ("/skin/board/webbus2009_basic/img/icon_new.gif",         "gb_icon_new.gif"),  # 2 / 2
    ("/skin/board/webbus2009_basic/img/icon_notice.gif",      "gb_icon_notice.gif"),  # 2 / 2
    ("/skin/board/webbus2009_basic/img/icon_reply.gif",       "gb_icon_reply.gif"),  # 1 / 1
]


# ── CDX probe ───────────────────────────────────────────────────────────


def _pick_latest_valid(rows: list, *, from_ts: str, to_ts: str) -> dict | None:
    """Latest `status==200 + mimetype image/*` row inside the window, or None."""
    valid = []
    for r in rows:
        if r.get("statuscode") != "200":
            continue
        if not r.get("mimetype", "").lower().startswith("image/"):
            continue
        if not (from_ts <= r["timestamp"] <= to_ts):
            continue
        # length parse (CDX may say "-")
        length_raw = r.get("length")
        try:
            length = int(length_raw) if length_raw and length_raw != "-" else 0
        except ValueError:
            length = 0
        if length <= 0:
            continue
        valid.append({
            "timestamp": r["timestamp"],
            "original":  r["original"],
            "mimetype":  r["mimetype"],
            "statuscode": r["statuscode"],
            "digest":    r["digest"],
            "length":    length_raw,
        })
    if not valid:
        return None
    return max(valid, key=lambda v: v["timestamp"])


def cdx_probe(path: str, *, from_ts: str, to_ts: str) -> dict | None:
    """Find the latest valid capture of `forg.co.kr{path}` in the window.

    The prefix sweeps already on disk (`cdx/image-*.jsonl`) are consulted
    first; a hit there costs no request. Only a path they do not answer goes
    to Wayback as a single-URL CDX query.
    """
    # A path is server-relative on forg.co.kr unless it names its own host.
    # frame-main-2003 pulled 13 images from hosting27.interpia98.net/~forg/,
    # which a forg.co.kr-only probe can never see.
    target = path if path.startswith("http") else f"forg.co.kr{path}"
    # Wayback's urlkey drops `www.`, so its exact-match probe answers with
    # both hosts; read the local sweep the same way.
    local = local_cdx_rows(f"http://{target}") + (
        local_cdx_rows(f"http://www.{target}") if not path.startswith("http") else []
    )
    picked = _pick_latest_valid(local, from_ts=from_ts, to_ts=to_ts)
    if picked is not None:
        picked["source"] = "local-index"
        return picked
    params = {
        "url": target,
        "output": "json",
        "from": from_ts,
        "to": to_ts,
        "limit": "20",
        # Single URL queries default to exact match — no matchType=prefix.
    }
    url = f"{CDX_ENDPOINT}?{urlencode(params)}"
    with global_polite_slot():
        try:
            raw = fetch_with_retry(url)
        except WaybackGoneError:
            return None
        # Exhausted retries is not an answer. Let it surface as an error so the
        # report does not record a Wayback outage as "missing" and skip the
        # path forever (2026-09-20: an evening of 503s did exactly that).
    try:
        data = json.loads(raw.decode("utf-8") or "[]")
    except json.JSONDecodeError:
        return None
    if not data:
        return None
    header, *rows = data
    cols = {name: i for i, name in enumerate(header)}
    return _pick_latest_valid(
        [dict(zip(header, r)) for r in rows if r and len(r) >= len(cols)],
        from_ts=from_ts,
        to_ts=to_ts,
    )


# ── Per-asset fetch ─────────────────────────────────────────────────────


def fetch_asset(target_path: str, filename: str) -> dict:
    out = OUT_DIR / filename
    if out.exists() and out.stat().st_size > 0:
        return {
            "status": "skipped",
            "path": target_path,
            "filename": filename,
        }

    try:
        cdx = cdx_probe(target_path, from_ts=FROM_TS, to_ts=TO_TS)
    except WaybackError as e:
        return {
            "status": "error",
            "path": target_path,
            "filename": filename,
            "error": f"cdx probe: {str(e)[:200]}",
        }
    if cdx is None:
        return {
            "status": "missing",
            "path": target_path,
            "filename": filename,
            "reason": "no_valid_image_row",
        }

    wb = wayback_url(cdx["timestamp"], cdx["original"])
    try:
        with global_polite_slot():
            data = fetch_with_retry(wb)
    except WaybackGoneError as e:
        return {
            "status": "error",
            "path": target_path,
            "filename": filename,
            "wayback_url": wb,
            "error": str(e),
        }
    except WaybackError as e:
        return {
            "status": "error",
            "path": target_path,
            "filename": filename,
            "wayback_url": wb,
            "error": str(e)[:200],
        }

    sha256_hex = hashlib.sha256(data).hexdigest()
    write_atomic(out, data)
    return {
        "status": "ok",
        "path": target_path,
        "filename": filename,
        "wayback_ts": cdx["timestamp"],
        "wayback_original": cdx["original"],
        "bytes": len(data),
        "sha256": sha256_hex,
        "mimetype": cdx["mimetype"],
    }


# ── Manifest sidecar ────────────────────────────────────────────────────


def update_manifest(entry: dict) -> None:
    """Append (or overwrite by filename) one entry in the flat manifest."""
    if entry.get("status") != "ok":
        return
    entries: list[dict] = []
    if MANIFEST_FILE.exists():
        try:
            entries = json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
            if not isinstance(entries, list):
                entries = []
        except json.JSONDecodeError:
            entries = []
    entries = [e for e in entries if e.get("filename") != entry["filename"]]
    entries.append({
        "originalPath": entry["path"],
        "filename":     entry["filename"],
        "capturedAt":   entry["wayback_ts"],
        "sizeBytes":    entry["bytes"],
        "sha256":       entry["sha256"],
        "mimetype":     entry["mimetype"],
    })
    entries.sort(key=lambda e: e["filename"])
    tmp = MANIFEST_FILE.with_suffix(MANIFEST_FILE.suffix + ".tmp")
    tmp.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    tmp.replace(MANIFEST_FILE)


# ── Driver ──────────────────────────────────────────────────────────────


def write_report(path: Path, targets: list, stats: dict, results: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "ts": datetime.now().isoformat(timespec="seconds"),
        "targets": len(targets),
        "stats": stats,
        "results": results,
    }
    write_atomic(path, json.dumps(report, indent=2, ensure_ascii=False) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(__doc__ or "chrome recovery").split("\n", 1)[0]
    )
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--print-every", type=int, default=5)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--retry-missing",
        action="store_true",
        help=(
            "Re-probe paths the previous report for this pool marked missing. "
            "Off by default: a miss is a CDX answer, and asking again costs a "
            "rate-limited request for the same answer."
        ),
    )
    parser.add_argument(
        "--era",
        choices=sorted(ERA_WINDOWS),
        help=(
            "Recover the capture nearest that era instead of the newest one, "
            "into public/img/chrome/<era>/. Without it the flat pool is used."
        ),
    )
    args = parser.parse_args()

    global OUT_DIR, MANIFEST_FILE, REPORT_FILE, FROM_TS, TO_TS
    flat_report = REPORT_FILE
    if args.era:
        FROM_TS, TO_TS = ERA_WINDOWS[args.era]
        OUT_DIR = OUT_DIR / args.era
        MANIFEST_FILE = OUT_DIR / ".manifest.json"
        REPORT_FILE = REPORT_FILE.with_name(f".chrome-recovery-report-{args.era}.json")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    targets = CHROME_TARGETS[: args.limit] if args.limit else CHROME_TARGETS

    # Paths this pool's last report already answered "missing" for. Files
    # that were found are skipped by fetch_asset via the on-disk check; this
    # is the equivalent for the ones that were not, so a top-up run only
    # spends requests on targets it has never asked about.
    # An era window is a subset of the flat pool's 1999–2015 window, so a
    # miss recorded there is a miss here too. Those five (hover variants,
    # r_logo_1) are also the probes Wayback answers slowest — a CDX query
    # with no hit sat through 503s and a timeout into a 30-minute backoff.
    known_missing: set[str] = set()
    if not args.retry_missing:
        for report in {REPORT_FILE, flat_report}:
            if not report.exists():
                continue
            try:
                prev = json.loads(report.read_text(encoding="utf-8"))
                known_missing |= {
                    r["path"] for r in prev.get("results", []) if r.get("status") == "missing"
                }
            except (OSError, json.JSONDecodeError, KeyError):
                continue
    print(
        f"[recover-chrome] targets={len(targets)} output={OUT_DIR} "
        f"window={FROM_TS[:8]}..{TO_TS[:8]} dry_run={args.dry_run}",
        file=sys.stderr,
    )

    stats = {"ok": 0, "skipped": 0, "missing": 0, "error": 0, "bytes": 0}
    results: list[dict] = []
    last_print = 0
    t0 = time.time()
    for i, (path, filename) in enumerate(targets, 1):
        if args.dry_run:
            print(f"  would probe forg.co.kr{path} -> {filename}", file=sys.stderr)
            continue
        if path in known_missing:
            result = {"status": "missing", "path": path, "filename": filename,
                      "reason": "known_missing_from_previous_run"}
        else:
            result = fetch_asset(path, filename)
        results.append(result)
        stats[result["status"]] = stats.get(result["status"], 0) + 1
        if result["status"] == "ok":
            stats["bytes"] += result.get("bytes", 0)
            update_manifest(result)
        if not args.dry_run:
            # After every result, so an interrupted run keeps its answers.
            write_report(REPORT_FILE, targets, stats, results)
        if i - last_print >= args.print_every or i == len(targets):
            last_print = i
            elapsed = int(time.time() - t0)
            print(
                f"[{i:>3}/{len(targets)}] ok={stats['ok']} skip={stats['skipped']} "
                f"missing={stats['missing']} err={stats['error']} "
                f"{stats['bytes'] / 1024:.1f}KB elapsed={elapsed}s",
                file=sys.stderr,
                flush=True,
            )

    if not args.dry_run:
        write_report(REPORT_FILE, targets, stats, results)

    print(
        f"\n[recover-chrome] DONE ok={stats['ok']} skip={stats['skipped']} "
        f"missing={stats['missing']} err={stats['error']} "
        f"{stats['bytes'] / 1024:.1f}KB",
        file=sys.stderr,
    )
    if not args.dry_run:
        print(f"Report: {REPORT_FILE.relative_to(PROJECT_ROOT)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
