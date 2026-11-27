#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."

echo "== backend tests =="
PYTHONPATH=backend python3 -m pytest backend -q

echo "== frontend build =="
npm --prefix frontend run build
