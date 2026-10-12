#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

cleanup() {
  docker compose logs --no-color backend postgres || true
  docker compose down -v || true
}
trap cleanup EXIT

cp .env.example .env

docker compose up --build -d

echo "Waiting for backend health..."
healthy=0
for _ in $(seq 1 60); do
  if curl -fsS "$BASE_URL/health" >/tmp/health.json 2>/dev/null; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "Backend never became healthy"
  exit 1
fi

node -e '
const fs = require("fs");
const health = JSON.parse(fs.readFileSync("/tmp/health.json", "utf8"));
if (health.status !== "ok" || health.database !== "connected") process.exit(1);
console.log("health ok");
'

REGISTER=$(curl -fsS -X POST "$BASE_URL/auth/register"   -H "Content-Type: application/json"   -d '{"username":"ciuser","email":"ci@example.com","password":"password123"}')

echo "$REGISTER" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id || j.email!=="ci@example.com") process.exit(1); console.log("register ok");});
'

LOGIN=$(curl -fsS -X POST "$BASE_URL/auth/login"   -H "Content-Type: application/json"   -d '{"email":"ci@example.com","password":"password123"}')

TOKEN=$(printf '%s' "$LOGIN" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.token) process.exit(1); process.stdout.write(j.token);});
')

curl -fsS "$BASE_URL/auth/me"   -H "Authorization: Bearer $TOKEN"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.email!=="ci@example.com") process.exit(1); console.log("auth me ok");});
'

printf 'hello ft_transcendence\n' >/tmp/sample.txt

UPLOAD1=$(curl -fsS -X POST "$BASE_URL/artifacts/files"   -H "Authorization: Bearer $TOKEN"   -F "file=@/tmp/sample.txt;type=text/plain"   -F "visibility=PUBLIC")

ARTIFACT_ID=$(printf '%s' "$UPLOAD1" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.artifact?.id || j.reusedScan !== false || !j.scan?.id) process.exit(1); process.stdout.write(j.artifact.id);});
')

echo "first upload ok: $ARTIFACT_ID"

UPLOAD2=$(curl -fsS -X POST "$BASE_URL/artifacts/files"   -H "Authorization: Bearer $TOKEN"   -F "file=@/tmp/sample.txt;type=text/plain"   -F "visibility=PUBLIC")

printf '%s' "$UPLOAD2" | ARTIFACT_ID="$ARTIFACT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.artifact?.id!==process.env.ARTIFACT_ID || j.reusedScan!==true) process.exit(1); console.log("dedup/cache reuse ok");});
'

curl -fsS "$BASE_URL/artifacts/$ARTIFACT_ID"   -H "Authorization: Bearer $TOKEN"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.file?.sha256 || !j.latestScan) process.exit(1); console.log("artifact lookup ok");});
'

COMMENT=$(curl -fsS -X POST "$BASE_URL/artifacts/$ARTIFACT_ID/comments"   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"body":"CI smoke-test comment"}')

printf '%s' "$COMMENT" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.body!=="CI smoke-test comment") process.exit(1); console.log("comment ok");});
'

curl -fsS -X PUT "$BASE_URL/artifacts/$ARTIFACT_ID/vote"   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"verdict":"SUSPICIOUS"}'   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.verdict!=="SUSPICIOUS") process.exit(1); console.log("vote ok");});
'

curl -fsS "$BASE_URL/artifacts/$ARTIFACT_ID/votes"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.counts?.SUSPICIOUS!==1) process.exit(1); console.log("vote summary ok");});
'

curl -fsS "$BASE_URL/artifacts/$ARTIFACT_ID/comments"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || !j.some(x=>x.body==="CI smoke-test comment")) process.exit(1); console.log("comment list ok");});
'

curl -fsS "$BASE_URL/notifications"   -H "Authorization: Bearer $TOKEN"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || !j.some(x=>x.type==="SCAN_COMPLETED")) process.exit(1); console.log("notification persistence ok");});
'

HTTP_CODE=$(curl -sS -o /tmp/private-anon.json -w "%{http_code}"   -X POST "$BASE_URL/artifacts/files"   -F "file=@/tmp/sample.txt;type=text/plain"   -F "visibility=PRIVATE")

if [ "$HTTP_CODE" != "400" ]; then
  echo "anonymous private upload should return 400, got $HTTP_CODE"
  cat /tmp/private-anon.json
  exit 1
fi

echo "private access rule ok"

TABLE_COUNT=$(docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname = '\''public'\'';"')

if [ "$TABLE_COUNT" -lt 19 ]; then
  echo "Expected at least 19 application tables, found $TABLE_COUNT"
  exit 1
fi

echo "database tables ok: $TABLE_COUNT"
echo "SMOKE TEST PASSED"
