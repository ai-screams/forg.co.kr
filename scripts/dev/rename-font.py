"""
Rename an OFL font, as a Reserved Font Name requires of a Modified Version
(OFL 1.1 condition 3): in each file's name table, every record but the
copyright (0), trademark (7), licence (13) and licence URL (14) has the old
family name replaced by the new one; the PostScript names (6, 25) take both
without spaces. The files are saved
as WOFF2 in place. Stops when a renamed record still holds the reserved
word.

    uv run --with fonttools --with brotli python scripts/dev/rename-font.py \\
      --from "IBM Plex Sans KR" --to "Forg Sans KR" --reserved Plex FILE...

Used by scripts/dev/fetch-fonts-2026.mjs and scripts/dev/subset-digits-font.sh.
"""

import argparse
import sys

from fontTools.ttLib import TTFont

KEPT = {0, 7, 13, 14}
POSTSCRIPT = {6, 25}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--from", dest="old", required=True)
    parser.add_argument("--to", dest="new", required=True)
    parser.add_argument("--reserved", required=True)
    parser.add_argument("files", nargs="+")
    args = parser.parse_args()
    bare = (args.old.replace(" ", ""), args.new.replace(" ", ""))
    for path in args.files:
        font = TTFont(path)
        for record in font["name"].names:
            if record.nameID in KEPT:
                continue
            text = record.toUnicode()
            if record.nameID not in POSTSCRIPT:
                text = text.replace(args.old, args.new)
            text = text.replace(*bare)
            if args.reserved in text:
                print(f"{path}: name {record.nameID} still holds {args.reserved}: {text}", file=sys.stderr)
                return 1
            record.string = text
        font.flavor = "woff2"
        font.save(path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
