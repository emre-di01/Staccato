#!/usr/bin/env bash
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)
MIGRATIONS_DIR="supabase/migrations"
DB_CONTAINER="supabase_db_staccato"

# ─── Hilfsfunktionen ───────────────────────────────────────────────────────────

log() { echo "[deploy] $*"; }

get_applied_versions() {
  docker exec "$DB_CONTAINER" psql -U postgres -t -c \
    "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;" \
    | tr -d ' \r'
}

apply_migration() {
  local file="$1"
  local version name
  version=$(basename "$file" | cut -d_ -f1)
  name=$(basename "$file" .sql | cut -d_ -f2-)
  log "Migration $version ($name)..."
  docker exec -i "$DB_CONTAINER" psql -U postgres postgres < "$file"
  docker exec "$DB_CONTAINER" psql -U postgres postgres -c \
    "INSERT INTO supabase_migrations.schema_migrations (version, name)
     VALUES ('$version', '$name') ON CONFLICT DO NOTHING;" > /dev/null
}

apply_pending_migrations() {
  log "Prüfe ausstehende Migrationen..."
  local applied
  applied=$(get_applied_versions)
  local count=0
  for f in "$MIGRATIONS_DIR"/*.sql; do
    local version
    version=$(basename "$f" | cut -d_ -f1)
    if ! echo "$applied" | grep -qx "$version"; then
      apply_migration "$f"
      count=$((count + 1))
    fi
  done
  if [ "$count" -eq 0 ]; then
    log "Keine ausstehenden Migrationen."
  else
    log "$count Migration(en) angewendet."
  fi
}

# ─── Prod (main) ──────────────────────────────────────────────────────────────

deploy_prod() {
  log "=== PROD Deploy ==="

  if [ ! -f .env.prod ]; then
    echo "FEHLER: .env.prod nicht gefunden. Bitte aus .env kopieren: cp .env .env.prod"
    exit 1
  fi

  cp .env.prod .env
  apply_pending_migrations
  log "Frontend bauen..."
  npm run build
  log "=== PROD fertig. ==="
}

# ─── Dev (dev branch → Supabase Cloud) ───────────────────────────────────────

deploy_dev() {
  log "=== DEV Deploy ==="

  if [ ! -f .env.dev ]; then
    echo "FEHLER: .env.dev nicht gefunden. Vorlage: .env.dev.example"
    exit 1
  fi

  # Env laden ohne zu exportieren — nur für dieses Script
  set -a; source .env.dev; set +a

  if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
    echo "FEHLER: SUPABASE_ACCESS_TOKEN fehlt in .env.dev"
    exit 1
  fi

  cp .env.dev .env

  log "Migrationen auf Supabase Cloud pushen..."
  supabase db push

  log "Frontend bauen (→ dist-dev/)..."
  npx vite build --outDir dist-dev
  log "=== DEV fertig. ==="
}

# ─── Env wechseln (ohne Deploy) ───────────────────────────────────────────────

switch_env() {
  case "$1" in
    prod)
      [ -f .env.prod ] && cp .env.prod .env && log "Env → PROD" || echo "FEHLER: .env.prod fehlt"
      ;;
    dev)
      [ -f .env.dev ] && cp .env.dev .env && log "Env → DEV" || echo "FEHLER: .env.dev fehlt"
      ;;
    *)
      echo "Usage: ./deploy.sh env [prod|dev]"
      exit 1
      ;;
  esac
}

# ─── Entry point ──────────────────────────────────────────────────────────────

case "${1:-auto}" in
  auto)
    case "$BRANCH" in
      main) deploy_prod ;;
      dev)  deploy_dev ;;
      *)    echo "Branch '$BRANCH' unbekannt. Nur 'main' und 'dev' unterstützt."; exit 1 ;;
    esac
    ;;
  prod)   deploy_prod ;;
  dev)    deploy_dev ;;
  env)    switch_env "${2:-}" ;;
  migrate)
    case "$BRANCH" in
      main) apply_pending_migrations ;;
      dev)  supabase db push ;;
    esac
    ;;
  build)
    log "Frontend bauen..."
    npm run build
    ;;
  *)
    echo "Usage: ./deploy.sh [auto|prod|dev|env prod|env dev|migrate|build]"
    exit 1
    ;;
esac
