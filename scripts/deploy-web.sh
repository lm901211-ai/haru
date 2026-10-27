#!/usr/bin/env bash
# 아이폰용 웹앱을 GitHub Pages(gh-pages 브랜치)에 올린다.
# 사용법: scripts/deploy-web.sh <저장소 이름>   → https://<아이디>.github.io/<저장소 이름>/
set -euo pipefail
REPO_NAME="${1:?저장소 이름을 적어 주세요 (예: haru)}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(mktemp -d)"

cd "$ROOT"
WEB_BASE_URL="/$REPO_NAME" npx expo export --platform web --output-dir "$OUT"
touch "$OUT/.nojekyll" # _expo 폴더가 Jekyll 처리에서 빠지지 않도록
REMOTE="$(git remote get-url origin)"

cd "$OUT"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy web app"
git push -f "$REMOTE" gh-pages
echo "올림 완료: gh-pages 브랜치"
