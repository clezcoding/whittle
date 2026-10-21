#!/usr/bin/env bash
# Checks that every place that carries the version agrees, and optionally that it equals $1.
#
#   scripts/check-version.sh            # the three files agree with each other
#   scripts/check-version.sh 0.1.0      # ... and with this version (the release tag without "v")
set -euo pipefail
cd "$(dirname "$0")/.."

cargo=$(sed -n '/^\[workspace.package\]/,/^\[/{s/^version *= *"\(.*\)"/\1/p}' Cargo.toml | head -1)
tauri=$(sed -n 's/^ *"version": *"\(.*\)",\{0,1\}/\1/p' apps/gui/src-tauri/tauri.conf.json | head -1)
pkg=$(sed -n 's/^ *"version": *"\(.*\)",\{0,1\}/\1/p' apps/gui/package.json | head -1)

echo "Cargo.toml        $cargo"
echo "tauri.conf.json   $tauri"
echo "package.json      $pkg"

ok=1
[ -n "$cargo" ] && [ "$cargo" = "$tauri" ] && [ "$cargo" = "$pkg" ] || { echo "✗ versions differ"; ok=0; }
if [ -n "${1:-}" ] && [ "$1" != "$cargo" ]; then echo "✗ expected $1 (the tag)"; ok=0; fi
[ "$ok" = 1 ] || exit 1
echo "✓ version $cargo"
