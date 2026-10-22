#!/usr/bin/env bash
# Assemble the GitHub Pages site into ./_site: the hand-written page in site/, the interface
# fonts, the app screenshots and the README art. Used by the Pages workflow and for local preview:
#   ./scripts/build-site.sh && python3 -m http.server -d _site 4402
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf _site
mkdir -p _site/fonts _site/shots _site/art
cp site/index.html site/style.css site/main.js site/boot.js site/favicon.svg site/mark-body.svg site/mark-cut.svg _site/
cp apps/gui/public/fonts/*.woff2 _site/fonts/
cp docs/screenshots/*.png _site/shots/
cp assets/readme/*.svg _site/art/
touch _site/.nojekyll
echo "site assembled in _site ($(find _site -type f | wc -l | tr -d ' ') files)"

# Every local file the page refers to must exist, otherwise the site would ship with broken images.
python3 - <<'PY'
import re, pathlib, sys
root = pathlib.Path("_site")
missing = []
refs = []
html = (root / "index.html").read_text()
refs += re.findall(r'(?:src|href|data-dark|data-light)="([^"#]+)"', html)
refs += re.findall(r'url\("?([^")]+)"?\)', (root / "style.css").read_text())
for r in set(refs):
    if r.startswith(("http:", "https:", "mailto:", "data:")):
        continue
    if not (root / r).exists():
        missing.append(r)
if missing:
    sys.exit("site references missing files: " + ", ".join(sorted(missing)))
print(f"site check ok ({len(set(refs))} references)")
PY
