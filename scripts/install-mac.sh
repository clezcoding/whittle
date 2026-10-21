#!/usr/bin/env bash
# Builds Whittle from source and installs the app (and the `whittle` command) on this Mac.
#
#   ./scripts/install-mac.sh            build + install to /Applications
#   ./scripts/install-mac.sh --no-cli   skip the command-line tool
#   ./scripts/install-mac.sh --dmg      also keep a .dmg next to the repo
#
# Nothing here needs sudo unless /Applications is not writable for your user.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
WITH_CLI=1
KEEP_DMG=0
for arg in "$@"; do
  case "$arg" in
    --no-cli) WITH_CLI=0 ;;
    --dmg) KEEP_DMG=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

say()  { printf '\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(uname -s)" = "Darwin" ] || fail "Whittle's app is built for macOS."

say "Checking tools"
xcode-select -p >/dev/null 2>&1 || fail "Xcode command line tools are missing. Run: xcode-select --install"
command -v cargo >/dev/null 2>&1 || fail "Rust is missing. Install it from https://rustup.rs"
command -v node  >/dev/null 2>&1 || fail "Node.js is missing. Install it with: brew install node"
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then corepack enable && corepack prepare pnpm@latest --activate
  else fail "pnpm is missing. Install it with: brew install pnpm"; fi
fi

say "Installing interface dependencies"
( cd apps/gui && pnpm install --frozen-lockfile )

say "Building Whittle.app (first build takes a few minutes)"
BUNDLES="app"
[ "$KEEP_DMG" = 1 ] && BUNDLES="app,dmg"
( cd apps/gui && pnpm tauri build --bundles "$BUNDLES" )

APP="$(find "$ROOT/target" -path '*/release/bundle/macos/Whittle.app' -maxdepth 6 -type d 2>/dev/null | head -n1)"
[ -n "$APP" ] || fail "Build finished but Whittle.app was not found under target/."

DEST="/Applications"
if [ ! -w "$DEST" ]; then
  DEST="$HOME/Applications"
  mkdir -p "$DEST"
fi

say "Installing to $DEST"
# Quit a running copy so the files can be replaced.
osascript -e 'tell application "Whittle" to quit' >/dev/null 2>&1 || true
rm -rf "$DEST/Whittle.app"
cp -R "$APP" "$DEST/Whittle.app"
# Built locally, so it is not quarantined. This only matters if the copy came from a download.
xattr -dr com.apple.quarantine "$DEST/Whittle.app" 2>/dev/null || true

if [ "$KEEP_DMG" = 1 ]; then
  DMG="$(find "$ROOT/target" -path '*/release/bundle/dmg/*.dmg' -type f 2>/dev/null | head -n1)"
  [ -n "$DMG" ] && cp "$DMG" "$ROOT/" && say "Disk image: $ROOT/$(basename "$DMG")"
fi

if [ "$WITH_CLI" = 1 ]; then
  say "Installing the whittle command"
  cargo install --path crates/whittle-cli --locked --force
fi

say "Done. Opening Whittle"
open "$DEST/Whittle.app"
cat <<MSG

Whittle is installed in $DEST.
Some folders (Mail, Messages, Safari data) are protected by macOS. To scan them too, give Whittle
access under System Settings > Privacy & Security > Full Disk Access.
MSG
