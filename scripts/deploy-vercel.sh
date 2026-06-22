#!/usr/bin/env bash
# CrowdScout Japan — Vercel production deploy
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Building..."
npm run build

echo "==> Deploying to Vercel (production)..."
if [ -z "${VERCEL_TOKEN:-}" ]; then
  echo "Tip: run 'vercel login' first, or set VERCEL_TOKEN"
fi

npx vercel deploy --prod --yes

echo "==> Done. Set environment variables in Vercel Dashboard if not already configured."
