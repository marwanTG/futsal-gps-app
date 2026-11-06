#!/usr/bin/env bash
# Publishes the app to GitHub Pages: creates the public repo (first time),
# pushes the source, then pushes dist/index.html to the gh-pages branch.
set -e
cd "$(dirname "$0")/.."
GH="/c/Program Files/GitHub CLI/gh.exe"
REPO=marwanTG/futsal-gps-app
"$GH" repo view "$REPO" >/dev/null 2>&1 || "$GH" repo create "$REPO" --public --source . --description "Futsal match analysis from Amazfit/Zepp GPX files, runs fully in the browser"
git push -u origin main
npm run build
OUT=$(mktemp -d)
cp dist/index.html "$OUT/" && touch "$OUT/.nojekyll"
git -C "$OUT" init -q -b gh-pages
git -C "$OUT" -c user.name=marwanTG -c user.email=38076309+marwanTG@users.noreply.github.com add -A
git -C "$OUT" -c user.name=marwanTG -c user.email=38076309+marwanTG@users.noreply.github.com commit -q -m "Deploy app"
git -C "$OUT" push -q -f "https://github.com/$REPO.git" gh-pages
"$GH" api -X POST "repos/$REPO/pages" -f "source[branch]=gh-pages" -f "source[path]=/" >/dev/null 2>&1 || true
echo "Done: https://marwantg.github.io/futsal-gps-app/ (first publish takes 1-2 minutes)"
