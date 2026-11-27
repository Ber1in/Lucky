#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
docker compose exec -T db pg_dump --clean --if-exists \
  -U "${POSTGRES_USER:-dlt}" "${POSTGRES_DB:-dlt}" \
  > "$BACKUP_DIR/dlt-$STAMP.sql"

find "$BACKUP_DIR" -name 'dlt-*.sql' -mtime +14 -delete
echo "backup written: $BACKUP_DIR/dlt-$STAMP.sql"
