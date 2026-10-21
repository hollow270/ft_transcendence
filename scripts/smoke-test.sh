#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

cleanup() {
  docker compose logs --no-color frontend backend postgres clamav || true
  docker compose down -v || true
}
trap cleanup EXIT

cp .env.example .env
export SCAN_PROVIDER=development
export TWO_FACTOR_ENCRYPTION_KEY=ci-two-factor-encryption-key-0123456789abcdef

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

curl -fsS "$BASE_URL/artifacts/scanner/capabilities"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.provider!=="development" || j.configured!==true || typeof j.supportsPrivate!=="boolean" || !j.maxFileSizeMb) process.exit(1); console.log("scanner capabilities ok");});
'

echo "Waiting for React frontend..."
frontend_ready=0
for _ in $(seq 1 60); do
  if curl -fsS "$FRONTEND_URL" >/tmp/frontend.html 2>/dev/null; then
    frontend_ready=1
    break
  fi
  sleep 2
done

if [ "$frontend_ready" -ne 1 ]; then
  echo "Frontend never became healthy"
  exit 1
fi

grep -q "Transcendence Scanner" /tmp/frontend.html
echo "frontend dev server ok"

curl -fsS "$FRONTEND_URL/api/health"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.status!=="ok" || j.database!=="connected") process.exit(1); console.log("frontend API proxy ok");});
'

docker compose exec -T frontend npm run build
echo "frontend production build ok"

REGISTER=$(curl -fsS -X POST "$BASE_URL/auth/register"   -H "Content-Type: application/json"   -d '{"username":"ciuser","email":"ci@example.com","password":"password123"}')

echo "$REGISTER" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id || j.email!=="ci@example.com") process.exit(1); console.log("register ok");});
'

USER_ID=$(printf '%s' "$REGISTER" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id) process.exit(1); process.stdout.write(j.id);});
')

LOGIN=$(curl -fsS -X POST "$BASE_URL/auth/login"   -H "Content-Type: application/json"   -d '{"email":"ci@example.com","password":"password123"}')

TOKEN=$(printf '%s' "$LOGIN" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.token) process.exit(1); process.stdout.write(j.token);});
')

curl -fsS "$BASE_URL/auth/me"   -H "Authorization: Bearer $TOKEN"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.email!=="ci@example.com") process.exit(1); console.log("auth me ok");});
'

TWOFA_REGISTER=$(curl -fsS -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"twofauser","email":"twofa@example.com","password":"password123"}')

TWOFA_LOGIN=$(curl -fsS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"twofa@example.com","password":"password123"}')

TWOFA_TOKEN=$(printf '%s' "$TWOFA_LOGIN" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.requiresTwoFactor!==false || !j.token) process.exit(1); process.stdout.write(j.token);});
')

TWOFA_SETUP=$(curl -fsS -X POST "$BASE_URL/auth/2fa/setup" \
  -H "Authorization: Bearer $TWOFA_TOKEN")

TWOFA_SECRET=$(printf '%s' "$TWOFA_SETUP" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.secret || !j.otpauthUri) process.exit(1); process.stdout.write(j.secret);});
')

TWOFA_CODE=$(SECRET="$TWOFA_SECRET" node -e '
const crypto=require("crypto");
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const secret=process.env.SECRET || "";
let bits=0,current=0,out=[];
for(const ch of secret.replace(/=+$/g,"").toUpperCase()){
  const idx=alphabet.indexOf(ch); if(idx<0) process.exit(1);
  current=(current<<5)|idx; bits+=5;
  if(bits>=8){out.push((current>>>(bits-8))&255); bits-=8;}
}
const counter=Math.floor(Date.now()/1000/30);
const b=Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter));
const h=crypto.createHmac("sha1",Buffer.from(out)).update(b).digest();
const o=h[h.length-1]&15;
const n=((h[o]&127)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];
process.stdout.write(String(n%1000000).padStart(6,"0"));
')

curl -fsS -X POST "$BASE_URL/auth/2fa/enable" \
  -H "Authorization: Bearer $TWOFA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$TWOFA_CODE\"}" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.enabled!==true) process.exit(1);});
'

curl -fsS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"twofa@example.com","password":"password123"}' \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.requiresTwoFactor!==true || j.token) process.exit(1);});
'

curl -fsS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"twofa@example.com\",\"password\":\"password123\",\"totpCode\":\"$TWOFA_CODE\"}" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.requiresTwoFactor!==false || !j.token) process.exit(1); console.log("two-factor authentication flow ok");});
'

printf 'hello ft_transcendence\n' >/tmp/sample.txt

UPLOAD1=$(curl -fsS -X POST "$BASE_URL/artifacts/files"   -H "Authorization: Bearer $TOKEN"   -F "file=@/tmp/sample.txt;type=text/plain"   -F "visibility=PUBLIC")

ARTIFACT_ID=$(printf '%s' "$UPLOAD1" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.artifact?.id || j.reusedScan !== false || !j.scan?.id) process.exit(1); process.stdout.write(j.artifact.id);});
')

echo "first upload ok: $ARTIFACT_ID"

printf '%s' "$UPLOAD1" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.scan?.provider!=="development" || j.scan?.status!=="COMPLETED") process.exit(1); console.log("scanner provider lifecycle ok");});
'

SCAN_ID=$(printf '%s' "$UPLOAD1" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.scan?.id) process.exit(1); process.stdout.write(j.scan.id);});
')

UPLOAD2=$(curl -fsS -X POST "$BASE_URL/artifacts/files"   -H "Authorization: Bearer $TOKEN"   -F "file=@/tmp/sample.txt;type=text/plain"   -F "visibility=PUBLIC")

printf '%s' "$UPLOAD2" | ARTIFACT_ID="$ARTIFACT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.artifact?.id!==process.env.ARTIFACT_ID || j.reusedScan!==true) process.exit(1); console.log("dedup/cache reuse ok");});
'

curl -fsS "$BASE_URL/artifacts/$ARTIFACT_ID"   -H "Authorization: Bearer $TOKEN"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.file?.sha256 || !j.latestScan || j.submission?.originalFilename!=="sample.txt" || j.submission?.visibility!=="PUBLIC") process.exit(1); console.log("artifact lookup ok");});
'


RESCAN=$(curl -fsS -X POST "$BASE_URL/artifacts/$ARTIFACT_ID/rescan"   -H "Authorization: Bearer $TOKEN")

printf '%s' "$RESCAN" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.status!=="COMPLETED" || j.reason!=="MANUAL_RESCAN" || j.provider!=="development") process.exit(1); console.log("manual rescan ok");});
'

SCAN_HISTORY=$(curl -fsS "$BASE_URL/artifacts/$ARTIFACT_ID/scans"   -H "Authorization: Bearer $TOKEN")

printf '%s' "$SCAN_HISTORY" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || j.length < 2) process.exit(1); if(!j.some(x=>x.reason==="INITIAL")) process.exit(1); if(!j.some(x=>x.reason==="MANUAL_RESCAN")) process.exit(1); if(!j.every(x=>x.visibility==="PUBLIC")) process.exit(1); if(!j.every(x=>Array.isArray(x.engineResults))) process.exit(1); console.log("scan history ok");});
'

REFRESH=$(curl -fsS -X POST "$BASE_URL/artifacts/$ARTIFACT_ID/refresh"   -H "Authorization: Bearer $TOKEN")

printf '%s' "$REFRESH" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id || j.status!=="COMPLETED") process.exit(1); console.log("scan refresh endpoint ok");});
'

: >/tmp/empty-file.txt
EMPTY_CODE=$(curl -sS -o /tmp/empty-upload.json -w "%{http_code}"   -X POST "$BASE_URL/artifacts/files"   -F "file=@/tmp/empty-file.txt;type=text/plain"   -F "visibility=PUBLIC")

if [ "$EMPTY_CODE" != "400" ]; then
  echo "empty file upload should return 400, got $EMPTY_CODE"
  cat /tmp/empty-upload.json
  exit 1
fi

echo "file validation ok"

AI_EXPLAIN=$(curl -fsS -N -X POST "$BASE_URL/ai/scans/explain"   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d "{\"scanId\":\"$SCAN_ID\"}")

printf '%s' "$AI_EXPLAIN" | grep -q '"event":"start"'
printf '%s' "$AI_EXPLAIN" | grep -q '"event":"error"'
echo "AI scan authorization/context/SSE path ok"

AI_UNAUTH_CODE=$(curl -sS -o /tmp/ai-unauth.json -w "%{http_code}"   -X POST "$BASE_URL/ai/ask"   -H "Content-Type: application/json"   -d '{"prompt":"What is a trojan?"}')

if [ "$AI_UNAUTH_CODE" != "401" ]; then
  echo "AI endpoint should require authentication, got $AI_UNAUTH_CODE"
  cat /tmp/ai-unauth.json
  exit 1
fi

echo "AI auth guard ok"

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


printf 'private ft_transcendence file\n' >/tmp/private-sample.txt

PRIVATE_UPLOAD=$(curl -fsS -X POST "$BASE_URL/artifacts/files"   -H "Authorization: Bearer $TOKEN"   -F "file=@/tmp/private-sample.txt;type=text/plain"   -F "visibility=PRIVATE")

printf '%s' "$PRIVATE_UPLOAD" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.submission?.visibility!=="PRIVATE") process.exit(1); console.log("private authenticated upload ok");});
'

PRIVATE_ARTIFACT_ID=$(printf '%s' "$PRIVATE_UPLOAD" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.artifact?.id) process.exit(1); process.stdout.write(j.artifact.id);});
')

curl -fsS "$BASE_URL/artifacts/$PRIVATE_ARTIFACT_ID/scans"   -H "Authorization: Bearer $TOKEN"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || !j.length || !j.every(x=>x.visibility==="PRIVATE")) process.exit(1); console.log("private owner scan history ok");});
'

OWN_COMMUNITY=$(curl -fsS "$BASE_URL/users/$USER_ID/community"   -H "Authorization: Bearer $TOKEN")

printf '%s' "$OWN_COMMUNITY" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.isOwner!==true) process.exit(1); if(!j.submissions?.some(x=>x.visibility==="PUBLIC")) process.exit(1); if(!j.submissions?.some(x=>x.visibility==="PRIVATE")) process.exit(1); if(!j.comments?.some(x=>x.body==="CI smoke-test comment")) process.exit(1); console.log("own community activity ok");});
'

VIEWER_REGISTER=$(curl -fsS -X POST "$BASE_URL/auth/register"   -H "Content-Type: application/json"   -d '{"username":"viewer","email":"viewer@example.com","password":"password123"}')

VIEWER_LOGIN=$(curl -fsS -X POST "$BASE_URL/auth/login"   -H "Content-Type: application/json"   -d '{"email":"viewer@example.com","password":"password123"}')

VIEWER_TOKEN=$(printf '%s' "$VIEWER_LOGIN" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.token) process.exit(1); process.stdout.write(j.token);});
')

PRIVATE_HISTORY_CODE=$(curl -sS -o /tmp/private-history.json -w "%{http_code}"   "$BASE_URL/artifacts/$PRIVATE_ARTIFACT_ID/scans"   -H "Authorization: Bearer $VIEWER_TOKEN")

if [ "$PRIVATE_HISTORY_CODE" != "404" ]; then
  echo "private scan history should be hidden from another user, got $PRIVATE_HISTORY_CODE"
  cat /tmp/private-history.json
  exit 1
fi

echo "private scan history privacy ok"

PUBLIC_COMMUNITY=$(curl -fsS "$BASE_URL/users/$USER_ID/community"   -H "Authorization: Bearer $VIEWER_TOKEN")

printf '%s' "$PUBLIC_COMMUNITY" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.isOwner!==false) process.exit(1); if(!j.submissions?.length) process.exit(1); if(j.submissions.some(x=>x.visibility!=="PUBLIC")) process.exit(1); if(!j.comments?.some(x=>x.body==="CI smoke-test comment")) process.exit(1); console.log("user community privacy ok");});
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
