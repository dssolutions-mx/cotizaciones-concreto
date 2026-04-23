#!/usr/bin/env bash
# Create an annotated monthly tag. Usage:
#   ./scripts/tag-monthly-release.sh 2026 4
# Requires: clean working tree, correct HEAD checked out for the release snapshot.

set -euo pipefail

year="${1:-}"
month="${2:-}"

if [[ ! "$year" =~ ^20[0-9]{2}$ ]] || [[ ! "$month" =~ ^(1[0-2]|[1-9])$ ]]; then
  echo "Usage: $0 <YYYY> <M>   (M = 1-12, no leading zero required)" >&2
  exit 1
fi

tag="v${year}.${month}.0"
month_name="$(python3 -c "import calendar as c; print(c.month_name[int('${month}')], '${year}')")"
msg="Release ${year}.${month}.0 (${month_name})"

if git rev-parse "$tag" >/dev/null 2>&1; then
  echo "Tag $tag already exists." >&2
  exit 1
fi

git tag -a "$tag" -m "$msg"
echo "Created annotated tag $tag"
echo "Push with: git push origin $tag"
