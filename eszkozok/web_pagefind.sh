#!/usr/bin/env bash
# A szöveges keresőindex felépítése a web.py kimenetéből, részindexenként (egyben túl sok memóriát igényelne).
# Használat: eszkozok/web_pagefind.sh [_site]       (Node.js / npx kell hozzá)
set -euo pipefail
KI="${1:-_site}"; KI="${KI%/}"
for d in "${KI}_pagefind"/*/; do
  n=$(basename "$d")
  cel="$KI/pagefind"; [ "$n" = 0 ] || cel="$KI/pagefind$n"
  echo "Részindex $n -> $cel"
  npx --yes pagefind@1.6.0 --site "$d" --output-path "$cel" --quiet
done
rm -rf "${KI}_pagefind"
