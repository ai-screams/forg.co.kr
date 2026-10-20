#!/usr/bin/env bash
# Forg Digits: the digits, Latin letters and a few signs of D2Coding, for the
# 2026 era's record figures (dates, counts, page numbers; ADR-0023 §6). Its
# unicode-range lets the Hangul on the same line fall back to the body font.
#
#   bash scripts/dev/subset-digits-font.sh    # from the repository root
#
# Writes public/fonts/2026/forg-digits.woff2 (about 8.6 KB); run
# scripts/dev/fetch-fonts-2026.mjs after it, which links it from 2026.css.
# D2Coding reserves its name (OFL 1.1, Reserved Font Name), and a subset is a
# Modified Version, so the cut is renamed "Forg Digits" (rename-font.py); its
# copyright and licence records stay. The release zip is not kept.
#
# Needs curl, unzip and uv.
set -euo pipefail

VERSION=1.4.0
BUILD=20261003
URL="https://github.com/naver/d2-coding-font/releases/download/VER${VERSION}/D2Coding-Ver${VERSION}-${BUILD}.zip"
SHA256=17e2da5e2879006eb725b87943f7988736ef8b6c9f8b84bc8e3bdbcb8dd46744
RANGE="U+0020-007E,U+00B7,U+2013,U+2014,U+2026,U+2190-2193,U+2248,U+2264,U+2265"
OUT=public/fonts/2026/forg-digits.woff2

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

curl -fsSL -o "$work/d2.zip" "$URL"
actual=$( (sha256sum "$work/d2.zip" 2>/dev/null || shasum -a 256 "$work/d2.zip") | cut -d' ' -f1)
if [[ "$actual" != "$SHA256" ]]; then
  echo "D2Coding zip: sha256 $actual, expected $SHA256" >&2
  exit 1
fi
unzip -q -j "$work/d2.zip" "D2Coding/D2Coding-Ver${VERSION}-${BUILD}.ttf" -d "$work"

uvx --quiet --from fonttools --with brotli pyftsubset "$work/D2Coding-Ver${VERSION}-${BUILD}.ttf" \
  --unicodes="$RANGE" --flavor=woff2 --output-file="$work/digits.woff2"
uv run --quiet --with fonttools --with brotli python scripts/dev/rename-font.py \
  --from D2Coding --to "Forg Digits" --reserved D2Coding "$work/digits.woff2"

mkdir -p "$(dirname "$OUT")"
cat "$work/digits.woff2" >"$OUT"
echo "$OUT: $(wc -c <"$OUT") bytes"
