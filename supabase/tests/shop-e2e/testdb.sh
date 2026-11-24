#!/bin/bash
# Wegwerf-DB: Schema (ohne Daten) aus der lokalen Instanz + Ticket-Migrationen
S=$(mktemp -d); cd "$(dirname "$0")/../../.."
docker rm -f staccato_ticket_test >/dev/null 2>&1
docker exec supabase_db_staccato pg_dump -U postgres -s --no-publications --no-subscriptions postgres > $S/schema.sql
docker run -d --name staccato_ticket_test --network none -e POSTGRES_PASSWORD=test public.ecr.aws/supabase/postgres:17.6.1.121 >/dev/null
for i in $(seq 1 40); do docker exec staccato_ticket_test pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1 && break; sleep 1; done; sleep 6
docker exec -i staccato_ticket_test psql -U supabase_admin -h 127.0.0.1 -q postgres < $S/schema.sql >/dev/null 2>&1
Q="docker exec -i staccato_ticket_test psql -U postgres -h 127.0.0.1 -q -v ON_ERROR_STOP=1 postgres"
echo "insert into schulen(id,name) values ('00000000-0000-0000-0000-000000000001','Standard')" | $Q
for r in 1 2; do for f in supabase/migrations/20261124*; do $Q --single-transaction < $f 2>&1 | grep -vE "NOTICE|schedule|^-+$|^ +[0-9]+$|^\(1 row|^$"; done; done
rm -f $S/schema.sql
