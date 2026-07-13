#!/usr/bin/env bash
# Assemble dist/ for Cloudflare Pages from the SPA's static assets ONLY.
# Explicit allowlist — never copies api/, lib/, scripts/, functions/,
# node_modules/, prototypes/, .github/, env files, or anything server-side.
# Pages Functions live in functions/ at the repo root and are bundled by
# wrangler at deploy time; they are NOT part of dist/.
#
# Usage: scripts/build-pages.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST="$ROOT/dist"

rm -rf "$DIST"
mkdir -p "$DIST"

# --- SPA static assets (the site's sacred visual identity — copied verbatim) ---
cp "$ROOT/index.html"  "$DIST/"
cp "$ROOT/app.js"      "$DIST/"
cp "$ROOT/styles.css"  "$DIST/"
cp "$ROOT/robots.txt"  "$DIST/"
cp -R "$ROOT/js"       "$DIST/js"       # js/truthpass.js
cp -R "$ROOT/assets"   "$DIST/assets"   # assets/fonts/, assets/images/

# --- Cloudflare Pages config files ---
cp "$ROOT/_redirects" "$DIST/"
cp "$ROOT/_headers"   "$DIST/"

# macOS cruft, if any slipped in via cp -R
find "$DIST" -name '.DS_Store' -delete

echo "dist/ assembled:"
find "$DIST" -type f | sed "s|^$DIST/|  |" | sort
