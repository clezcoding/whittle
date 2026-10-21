#!/usr/bin/env bash
# Double-click in Finder to build and install Whittle.
cd "$(dirname "$0")" && ./scripts/install-mac.sh
status=$?
echo
read -r -p "Press Return to close this window." _
exit $status
