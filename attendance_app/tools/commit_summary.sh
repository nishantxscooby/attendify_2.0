#!/usr/bin/env bash
set -euo pipefail

# commit_summary.sh
# Summarises recent git activity in Markdown for changelog or stand-up notes.
# Usage: ./tools/commit_summary.sh [commit-range]
# Example ranges: main..HEAD, HEAD~10..HEAD, --since="1 week ago" --until=HEAD
# Defaults to the last 20 commits when no range is supplied.

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository" >&2
  exit 1
fi

# Capture provided range/options or fall back to the latest 20 commits.
range_desc="last 20 commits"
log_args=()
if [[ $# -gt 0 ]]; then
  log_args=("$1")
  range_desc="$1"
else
  log_args=(-n 20)
fi

# Collect commit SHAs for subsequent sections.
commits=()
while IFS= read -r sha; do
  [[ -n "$sha" ]] && commits+=("$sha")
done < <(git log "${log_args[@]}" --pretty=%H)

if [[ ${#commits[@]} -eq 0 ]]; then
  echo "No commits found for range: $range_desc" >&2
  exit 0
fi

echo "# Commit summary for $range_desc"
echo
echo "## Highlights"
for sha in "${commits[@]}"; do
  git show -s --format='* %ad %h %s (%an)' --date=short "$sha"
done

echo
echo "## Areas touched"
areas=$(git log "${log_args[@]}" --name-only --pretty=format: \
  | awk 'NF' \
  | sort \
  | uniq -c \
  | sort -rn \
  | head -n 20 \
  | awk '{count=$1; $1=""; path=substr($0,2); printf("* %s — %s changes\n", path, count);}')

if [[ -n "$areas" ]]; then
  printf '%s\n' "$areas"
else
  echo '* (no file changes)'
fi

echo
echo "## Authors"
authors=$(git log "${log_args[@]}" --format='%an' \
  | awk 'NF' \
  | sort \
  | uniq -c \
  | sort -rn \
  | awk '{count=$1; $1=""; name=substr($0,2); printf("* %s — %s %s\n", name, count, (count==1?"commit":"commits"));}')

if [[ -n "$authors" ]]; then
  printf '%s\n' "$authors"
else
  echo '* (no authors found)'
fi
