#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_container="mas-db-tests-$$"
cleanup() { docker rm -f "$test_container" > /dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$test_container" -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=mas_test postgres:17-alpine > /dev/null
for attempt in $(seq 1 30); do
  if docker exec "$test_container" psql -h 127.0.0.1 -U postgres -d mas_test -c 'select 1' > /dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$test_container" psql -U postgres -d mas_test -v ON_ERROR_STOP=1 < tests/database/bootstrap.sql > /dev/null
for migration_file in supabase/migrations/*.sql; do
  docker exec -i "$test_container" psql -U postgres -d mas_test -v ON_ERROR_STOP=1 < "$migration_file" > /dev/null
done
docker exec -i "$test_container" psql -U postgres -d mas_test -v ON_ERROR_STOP=1 < tests/database/integration.sql
node tests/database/concurrency.cjs "$test_container"
