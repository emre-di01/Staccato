#!/bin/bash
S=$(cd "$(dirname "$0")" && pwd); R=$(cd "$S/../../.." && pwd); JWT=super-secret-jwt-token-for-local-tests-only-32
docker rm -f t-edge t-gw t-rest t-mail staccato_ticket_test >/dev/null 2>&1; docker network rm ticket-e2e >/dev/null 2>&1
$S/testdb.sh; docker network create ticket-e2e >/dev/null; docker network disconnect none staccato_ticket_test; docker network connect ticket-e2e staccato_ticket_test
docker exec -i staccato_ticket_test psql -U supabase_admin -h 127.0.0.1 -q postgres -c "alter role authenticator with login password 'pw'"
DBIP=$(docker inspect staccato_ticket_test --format '{{(index .NetworkSettings.Networks "ticket-e2e").IPAddress}}')
docker run -d --name t-rest --network ticket-e2e -e PGRST_DB_URI="postgres://authenticator:pw@$DBIP:5432/postgres" -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET=$JWT public.ecr.aws/supabase/postgrest:v14.8 >/dev/null
docker run -d --name t-gw --network ticket-e2e -p 127.0.0.1:18001:8001 -p 127.0.0.1:18000:8000 -v $S/gw.py:/gw.py:ro python:3-alpine python -u /gw.py >/dev/null
docker run -d --name t-mail --network ticket-e2e -p 127.0.0.1:18025:8025 -e MP_SMTP_AUTH_ACCEPT_ANY=1 -e MP_SMTP_AUTH_ALLOW_INSECURE=1 public.ecr.aws/supabase/mailpit:v1.22.3 >/dev/null
MIP=$(docker inspect t-mail --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
TOK(){ python3 -c "
import hmac,hashlib,base64,json,sys
b=lambda x: base64.urlsafe_b64encode(x).rstrip(b'=').decode()
h=b(b'{\"alg\":\"HS256\",\"typ\":\"JWT\"}'); p=b(sys.argv[1].encode()); print(h+'.'+p+'.'+b(hmac.new(b'$JWT',(h+'.'+p).encode(),hashlib.sha256).digest()))" "$1"; }
SVC=$(TOK '{"role":"service_role","exp":4102444800}'); ANON=$(TOK '{"role":"anon","exp":4102444800}')
echo "ANON=$ANON" > $S/e2e.env; for n in 01 02 20; do echo "U$n=$(TOK "{\"role\":\"authenticated\",\"sub\":\"8a000000-0000-0000-0000-0000000000$n\",\"exp\":4102444800}")" >> $S/e2e.env; done
docker run -d --name t-edge --network ticket-e2e -p 127.0.0.1:19000:9000 -v ${FN:-$R/supabase/functions}:/fn:ro -v $S/main:/fnmain:ro -e SUPABASE_URL=http://t-gw:8000 -e SUPABASE_ANON_KEY=$ANON -e SUPABASE_SERVICE_ROLE_KEY=$SVC -e STRIPE_LIVE_ERLAUBT=${LIVE-true} -e STRIPE_API=http://t-gw:8001 -e OEFFENTLICHE_API_URL=https://api.example.test -e ZAHLUNG_SCHLUESSEL=$(head -c32 /dev/urandom | base64 -w0) -e SMTP_HOST=$MIP -e SMTP_PORT=1025 -e SMTP_USER=u -e SMTP_PASS=p -e SMTP_FROM=t@example.test -e APP_URL=https://app.example.test --entrypoint edge-runtime public.ecr.aws/supabase/edge-runtime:v1.73.3 start --main-service /fnmain --port 9000 >/dev/null
Q="docker exec -i staccato_ticket_test psql -U postgres -h 127.0.0.1 -qtA -v ON_ERROR_STOP=1 postgres"; $Q < $S/fix.sql
cat <<'SQL' | $Q >/dev/null
select set_config('request.jwt.claims','',false);
update profiles set rolle='admin' where id='8a000000-0000-0000-0000-000000000020'; update schul_mitgliedschaften set rolle='admin' where user_id='8a000000-0000-0000-0000-000000000020';
update ticket_einstellungen set shop_aktiv=true, kapazitaet=4 where event_id='83000000-0000-0000-0000-000000000001';
insert into ticket_shops(schule_id,slug,aktiv,impressum,agb,datenschutz) values('81111111-1111-1111-1111-111111111111','probe',true,'I','A','D');
SQL
docker exec supabase_db_staccato psql -U postgres -tAc "select pg_get_functiondef('auth.uid'::regproc)||';'; select pg_get_functiondef('auth.role'::regproc)||';'" | docker exec -i staccato_ticket_test psql -U supabase_admin -h 127.0.0.1 -q postgres
sleep 6
