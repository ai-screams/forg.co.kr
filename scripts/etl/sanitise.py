#!/usr/bin/env python3
"""The one nh3 configuration every parser sanitises post bodies with (ADR-0008 §5).

Lived as an identical copy in 02 / 02b / 02d until a fourth parser (02e,
the link/diary skins) arrived — the point at which 02b's docstring said to
extract it.
"""
from __future__ import annotations

import nh3

SANITISER_TAGS = {
    "p", "br", "b", "i", "u", "strong", "em", "a", "img", "span",
    "div", "table", "tr", "td", "th", "tbody", "thead", "tfoot",
    "ul", "ol", "li", "blockquote", "font", "center", "hr",
    "h1", "h2", "h3", "h4", "h5", "h6", "pre", "code",
}  # fmt: skip
SANITISER_ATTRS: dict[str, set[str]] = {
    "a": {"href", "title"},
    # `data-recovery` and `data-original-src` are stamped by Phase F
    # (`04-rewrite-image-urls.py`) — keep them on the allowlist so a future
    # nh3 pass cannot silently strip the recovery metadata. ADR-0010 §5.
    "img": {
        "src", "alt", "width", "height", "border", "title",
        "data-recovery", "data-original-src",
    },  # fmt: skip
    "td": {"colspan", "rowspan", "align", "valign", "bgcolor", "width", "height"},
    "th": {"colspan", "rowspan", "align", "valign", "bgcolor", "width", "height"},
    "table": {"border", "cellpadding", "cellspacing", "width", "bgcolor"},
    "font": {"color", "size", "face"},
    "*": {"style", "class"},
}
SANITISER_URL_SCHEMES = {"http", "https", "mailto"}


def sanitise_html(html: str) -> str:
    return nh3.clean(
        html,
        tags=SANITISER_TAGS,
        attributes=SANITISER_ATTRS,
        url_schemes=SANITISER_URL_SCHEMES,
        link_rel=None,
    )
