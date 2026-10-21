#!/usr/bin/env bash
# Fails if the repository contains files that do not belong in it.
#
#   scripts/check-repo-hygiene.sh            # checks tracked + staged files
#   scripts/check-repo-hygiene.sh --all      # also reports untracked, non-ignored files
#
# Used by the pre-commit hook (scripts/hooks/pre-commit) and by CI.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 1. Only these top-level entries may exist in the repository.
ALLOWED_TOP='^(\.github|\.clusterfuzzlite|apps|assets|crates|docs|fuzz|packaging|rules|scripts|tools|\.gitignore|\.gitattributes|\.editorconfig|\.gitleaks\.toml|\.kodiak\.toml|osv-scanner\.toml|\.pre-commit-config\.yaml|Cargo\.toml|Cargo\.lock|rust-toolchain\.toml|rustfmt\.toml|clippy\.toml|deny\.toml|CHANGELOG\.md|CODE_OF_CONDUCT\.md|CONTRIBUTING\.md|LICENSE-APACHE|LICENSE-MIT|Makefile|README\.md|README\.de\.md|SECURITY\.md|SUPPORT\.md|GOVERNANCE\.md|Install Whittle\.command)$'

# 2. These must never be tracked, anywhere.
FORBIDDEN='(^|/)(\.DS_Store|node_modules|target|dist|\.env(\..*)?|Thumbs\.db|\.idea|\.claude|__pycache__)(/|$)|\.(tar|tgz|gz|zip|dmg|pkg|app|exe|msi|p12|pfx|pem|key|log|orig|rej|bak|swp|tmp|old)$|\.tar\.gz$| copy(\.|$)'

fail=0
if [ "${1:-}" = "--all" ]; then
  files=$( { git ls-files; git ls-files --others --exclude-standard; } | sort -u )
else
  files=$( { git ls-files; git diff --cached --name-only --diff-filter=ACMR; } | sort -u )
fi

while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ -e "$f" ] || continue   # deleted in working tree
  top="${f%%/*}"
  if ! [[ "$top" =~ $ALLOWED_TOP ]]; then
    echo "✗ not an allowed top-level path: $f"; fail=1
  fi
  if [[ "$f" =~ $FORBIDDEN ]]; then
    echo "✗ forbidden file: $f"; fail=1
  fi
  # Files > 2 MiB are almost never source.
  size=$(wc -c < "$f" | tr -d ' ')
  if [ "$size" -gt 2097152 ]; then
    echo "✗ larger than 2 MiB ($size bytes): $f"; fail=1
  fi
done <<< "$files"

# 3. These must be tracked: the build breaks without them, and a too-greedy ignore rule
#    (e.g. one that matches `icons/` on a case-insensitive Mac) would drop them silently.
REQUIRED=(
  Cargo.toml Cargo.lock LICENSE-MIT LICENSE-APACHE README.md
  apps/gui/package.json apps/gui/pnpm-lock.yaml apps/gui/index.html
  apps/gui/src-tauri/tauri.conf.json apps/gui/src-tauri/Cargo.toml
  apps/gui/src-tauri/icons/32x32.png apps/gui/src-tauri/icons/128x128.png
  apps/gui/src-tauri/icons/128x128@2x.png apps/gui/src-tauri/icons/icon.icns
  apps/gui/src-tauri/icons/icon.ico apps/gui/src-tauri/icons/icon.png
  apps/gui/public/fonts/switzer-400-normal.woff2
  rules/caches.yaml rules/orphans.yaml rules/tidy.yaml
)
for f in "${REQUIRED[@]}"; do
  if ! git ls-files --error-unmatch -- "$f" >/dev/null 2>&1 && ! git diff --cached --name-only | grep -qxF "$f"; then
    echo "✗ required file is not tracked (ignored by .gitignore?): $f"; fail=1
  fi
done

# 4. Secrets and the maintainer's personal paths must never leak in.
leaks=$(git grep -nIiE 'ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|/Users/puzzless|/Desktop/ClezClean' -- . \
  ':!scripts/check-repo-hygiene.sh' || true)
if [ -n "$leaks" ]; then
  echo "✗ possible personal path or secret:"; echo "$leaks"; fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo; echo "Repository hygiene check failed. Remove the files above or extend .gitignore."
  exit 1
fi
echo "✓ repository hygiene OK ($(echo "$files" | grep -c .) files checked)"
