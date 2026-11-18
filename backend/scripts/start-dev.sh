#!/bin/sh
set -eu

BASELINE_MIGRATION="20261022084251_database_v1"

echo "Generating Prisma client..."
npx prisma generate

APP_TABLE_COUNT="$(psql "$DATABASE_URL" -Atqc "
  SELECT count(*)
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations';
")"

HAS_PRISMA_MIGRATIONS="$(psql "$DATABASE_URL" -Atqc "
  SELECT to_regclass('public._prisma_migrations') IS NOT NULL;
")"

if [ "$APP_TABLE_COUNT" -gt 0 ] && [ "$HAS_PRISMA_MIGRATIONS" != "t" ]; then
  if [ "$APP_TABLE_COUNT" -lt 19 ]; then
    echo "Refusing automatic migration baseline: found only $APP_TABLE_COUNT existing public tables."
    echo "Expected the complete pre-migration Database V1 schema (19 application tables)."
    exit 1
  fi

  echo "Existing db-push Database V1 detected."
  echo "Recording $BASELINE_MIGRATION as already applied without changing existing data."
  npx prisma migrate resolve --applied "$BASELINE_MIGRATION"
fi

echo "Applying pending Prisma migrations..."
npx prisma migrate deploy

exec npm run start:dev
