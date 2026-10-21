#!/usr/bin/env bash
# Renders the Homebrew formula and cask from packaging/homebrew/ for one release.
#
#   scripts/render-homebrew.sh 0.1.0 SHA256SUMS path/to/homebrew-tap
set -euo pipefail
cd "$(dirname "$0")/.."

version=${1:?version without v}
sums=${2:?path to SHA256SUMS}
out=${3:?output directory (the tap checkout)}

sha() {
  local v
  v=$(awk -v f="$1" '$2==f || $2=="*"f {print $1}' "$sums")
  [ -n "$v" ] || { echo "no checksum for $1 in $sums" >&2; exit 1; }
  echo "$v"
}

arm=$(sha "whittle-v${version}-aarch64-apple-darwin.tar.gz")
intel=$(sha "whittle-v${version}-x86_64-apple-darwin.tar.gz")
dmg=$(sha "Whittle_${version}_universal.dmg")

mkdir -p "$out/Formula" "$out/Casks"
render() {
  sed -e "s/@VERSION@/${version}/g" -e "s/@SHA_ARM@/${arm}/g" -e "s/@SHA_INTEL@/${intel}/g" -e "s/@SHA_DMG@/${dmg}/g" "$1" > "$2"
}
render packaging/homebrew/Formula/whittle.rb.in "$out/Formula/whittle.rb"
render packaging/homebrew/Casks/whittle.rb.in "$out/Casks/whittle.rb"
cp packaging/homebrew/README.md "$out/README.md"
echo "✓ rendered whittle ${version} into $out"
