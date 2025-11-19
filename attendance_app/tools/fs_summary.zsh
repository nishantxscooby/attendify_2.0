#!/usr/bin/env zsh
set -euo pipefail

cd "$(dirname "$0")/.."

mkdir -p docs

{
  echo "# Change summary (filesystem timestamps)"; echo

  echo "## Highlights (recent files)"
  { find lib -type f 2>/dev/null; find test -type f 2>/dev/null; [ -f pubspec.yaml ] && echo pubspec.yaml; } \
  | xargs -I{} stat -f "%Sm\t%N" -t "%Y-%m-%d %H:%M" {} \
  | sort -r | head -20 \
  | awk -F '\t' '{printf("* %s — %s\n", $2, $1)}'

  echo; echo "## Areas touched"
  { find lib -type f 2>/dev/null; find test -type f 2>/dev/null; [ -f pubspec.yaml ] && echo pubspec.yaml; } \
  | sed 's|^\./||' \
  | awk -F/ '{print ($1"/"$2)}' | sed 's|/$||' \
  | sort | uniq -c | sort -rn | head -20 \
  | awk '{c=$1; $1=""; p=substr($0,2); printf("* %s — %s changes\n", p, c)}'

  echo; echo "## Authors (file owners)"
  { find lib -type f 2>/dev/null; find test -type f 2>/dev/null; [ -f pubspec.yaml ] && echo pubspec.yaml; } \
  | xargs -I{} stat -f "%Su" {} \
  | sort | uniq -c | sort -rn \
  | awk '{c=$1; $1=""; n=substr($0,2); printf("* %s — %s files\n", n, c)}'
} > docs/CHANGE_SUMMARY.md

echo "Wrote docs/CHANGE_SUMMARY.md ✅"
