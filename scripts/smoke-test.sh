#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
PLAIN_HTTP_URL="${PLAIN_HTTP_URL:-http://localhost:8080}"
VAULT_PUBLIC_URL="${VAULT_PUBLIC_URL:-http://localhost:8200}"
HTTPS_WAF_URL="${HTTPS_WAF_URL:-https://localhost:8443}"

cleanup() {
  docker compose logs --no-color waf frontend backend postgres clamav vault vault-init || true
  docker compose down -v || true
}
trap cleanup EXIT

if command -v node >/dev/null 2>&1; then
  echo "Running accessibility audit..."
  node scripts/accessibility-audit.mjs
else
  echo "Skipping accessibility audit: node is not installed on this machine"
fi

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

grep -q "GO VIRUS" /tmp/frontend.html
echo "frontend dev server ok"

curl -fsS "$FRONTEND_URL/api/health"   | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.status!=="ok" || j.database!=="connected") process.exit(1); console.log("frontend API proxy ok");});
'


echo "Checking Vault..."

vault_state() {
  docker compose exec -T vault vault status -format=json 2>/dev/null || true
}

vault_state | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  if(!j.initialized || j.sealed) process.exit(1);
  console.log("vault initialized and unsealed");
});
'

STORED_KEY=$(docker compose exec -T vault-init sh -c '. /vault/keys/init.env; VAULT_TOKEN=$ROOT_TOKEN vault kv get -field=TWO_FACTOR_ENCRYPTION_KEY secret/go-virus/backend')

if [ "$STORED_KEY" != "$TWO_FACTOR_ENCRYPTION_KEY" ]; then
  echo "Vault does not hold the configured 2FA encryption key"
  exit 1
fi

for secret_name in TWO_FACTOR_ENCRYPTION_KEY CLAIM_TOKEN_SECRET OPENAI_API_KEY VIRUSTOTAL_API_KEY; do
  if [ -n "$(docker compose exec -T backend printenv "$secret_name" || true)" ]; then
    echo "$secret_name must not be an environment variable of the backend container"
    exit 1
  fi
done

if curl -sS --max-time 3 "$VAULT_PUBLIC_URL/v1/sys/health" >/dev/null 2>&1; then
  echo "Vault must not be published on the host"
  exit 1
fi

docker compose restart vault >/dev/null

vault_unsealed=0
for _ in $(seq 1 40); do
  if vault_state | grep -q '"sealed": false'; then
    vault_unsealed=1
    break
  fi
  sleep 2
done

if [ "$vault_unsealed" -ne 1 ]; then
  echo "Vault was not unsealed again after a restart"
  exit 1
fi

echo "Vault secrets, isolation and unseal after restart ok"

echo "Waiting for the HTTPS WAF endpoint..."
https_ready=0
for _ in $(seq 1 60); do
  if curl -kfsS "$HTTPS_WAF_URL/healthz" >/dev/null 2>&1; then
    https_ready=1
    break
  fi
  sleep 2
done

if [ "$https_ready" -ne 1 ]; then
  echo "HTTPS WAF endpoint never became ready"
  exit 1
fi

curl -kfsS --tlsv1.2 -D /tmp/waf-headers.txt "$HTTPS_WAF_URL/api/health" -o /tmp/waf-health.json

node -e '
const fs=require("fs");
const health=JSON.parse(fs.readFileSync("/tmp/waf-health.json","utf8"));
if(health.status!=="ok" || health.database!=="connected") process.exit(1);
'

grep -qi '^x-content-type-options: nosniff' /tmp/waf-headers.txt
grep -qi '^x-frame-options: DENY' /tmp/waf-headers.txt
grep -qi '^content-security-policy:' /tmp/waf-headers.txt

if grep -qi '^x-powered-by:' /tmp/waf-headers.txt; then
  echo "x-powered-by must not be exposed"
  exit 1
fi

echo "HTTPS WAF entrypoint ok"

if curl -sS --max-time 3 "$PLAIN_HTTP_URL/" >/dev/null 2>&1; then
  echo "Plain HTTP must not be published"
  exit 1
fi

echo "Plain HTTP is not reachable"

for probe in \
  "/api/artifacts/search?q=%3Cscript%3Ealert%281%29%3C%2Fscript%3E" \
  "/api/artifacts/search?q=1%27%20OR%20%271%27%3D%271"; do
  WAF_ATTACK_CODE=$(curl -ksS --path-as-is -o /tmp/waf-attack.html -w "%{http_code}" "$HTTPS_WAF_URL$probe")

  if [ "$WAF_ATTACK_CODE" != "403" ]; then
    echo "WAF should block $probe with 403, got $WAF_ATTACK_CODE"
    cat /tmp/waf-attack.html
    exit 1
  fi
done

TRAVERSAL_CODE=$(curl -ksS --path-as-is -o /dev/null -w "%{http_code}" "$HTTPS_WAF_URL/api/..%2f..%2f..%2fetc%2fpasswd")

if [ "$TRAVERSAL_CODE" != "400" ] && [ "$TRAVERSAL_CODE" != "403" ]; then
  echo "path traversal should be rejected with 400 or 403, got $TRAVERSAL_CODE"
  exit 1
fi

echo "OWASP CRS blocking mode ok"

curl -kfsS -D /tmp/waf-app-headers.txt "$HTTPS_WAF_URL/" -o /tmp/waf-app.html

grep -q 'id="root"' /tmp/waf-app.html
grep -q '/assets/' /tmp/waf-app.html
grep -qi "script-src 'self';" /tmp/waf-app-headers.txt

echo "Production frontend through HTTPS ok"

for legal_page in privacy terms; do
  legal_code=$(curl -ksS -o /dev/null -w "%{http_code}" "$HTTPS_WAF_URL/$legal_page")
  if [ "$legal_code" != "200" ]; then
    echo "/$legal_page should be served, got $legal_code"
    exit 1
  fi
done

echo "Privacy Policy and Terms of Service routes ok"

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

totp_code() {
  SECRET="$1" OFFSET="$2" node -e '
const crypto=require("crypto");
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const secret=process.env.SECRET || "";
let bits=0,current=0,out=[];
for(const ch of secret.replace(/=+$/g,"").toUpperCase()){
  const idx=alphabet.indexOf(ch); if(idx<0) process.exit(1);
  current=(current<<5)|idx; bits+=5;
  if(bits>=8){out.push((current>>>(bits-8))&255); bits-=8;}
}
const counter=Math.floor(Date.now()/1000/30)+Number(process.env.OFFSET);
const b=Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter));
const h=crypto.createHmac("sha1",Buffer.from(out)).update(b).digest();
const o=h[h.length-1]&15;
const n=((h[o]&127)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];
process.stdout.write(String(n%1000000).padStart(6,"0"));
'
}

TWOFA_CODE=$(totp_code "$TWOFA_SECRET" 0)

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

TWOFA_REPLAY_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"twofa@example.com\",\"password\":\"password123\",\"totpCode\":\"$TWOFA_CODE\"}")

if [ "$TWOFA_REPLAY_CODE" != "401" ]; then
  echo "reused two-factor code should return 401, got $TWOFA_REPLAY_CODE"
  exit 1
fi

echo "two-factor code reuse rejected ok"

TWOFA_LOGIN_CODE=$(totp_code "$TWOFA_SECRET" 1)

curl -fsS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"twofa@example.com\",\"password\":\"password123\",\"totpCode\":\"$TWOFA_LOGIN_CODE\"}" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.requiresTwoFactor!==false || !j.token) process.exit(1); console.log("two-factor authentication flow ok");});
'

TWOFA_DISABLE_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/2fa/disable" \
  -H "Authorization: Bearer $TWOFA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"code\":\"$TWOFA_LOGIN_CODE\"}")

if [ "$TWOFA_DISABLE_CODE" != "400" ]; then
  echo "disabling two-factor without the password should return 400, got $TWOFA_DISABLE_CODE"
  exit 1
fi

echo "two-factor disable requires password ok"

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


URL_UPLOAD1=$(curl -fsS -X POST "$BASE_URL/artifacts/urls" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"HTTPS://Example.COM:443/path#fragment","visibility":"PUBLIC"}')

URL_ARTIFACT_ID=$(printf '%s' "$URL_UPLOAD1" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.artifact?.id || j.artifact?.type!=="URL" || j.artifact?.normalizedUrl!=="https://example.com/path" || j.artifact?.domain!=="example.com" || j.reusedScan!==false || j.scan?.provider!=="development") process.exit(1); process.stdout.write(j.artifact.id);});
')

URL_UPLOAD2=$(curl -fsS -X POST "$BASE_URL/artifacts/urls" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/path#another-fragment","visibility":"PUBLIC"}')

printf '%s' "$URL_UPLOAD2" | URL_ARTIFACT_ID="$URL_ARTIFACT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.artifact?.id!==process.env.URL_ARTIFACT_ID || j.reusedScan!==true) process.exit(1); console.log("URL submission/dedup ok");});
'

curl -fsS "$BASE_URL/artifacts/$URL_ARTIFACT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.type!=="URL" || j.url?.normalizedUrl!=="https://example.com/path" || j.url?.domain!=="example.com" || !j.latestScan) process.exit(1); console.log("URL artifact lookup ok");});
'

URL_RESCAN=$(curl -fsS -X POST "$BASE_URL/artifacts/$URL_ARTIFACT_ID/rescan" \
  -H "Authorization: Bearer $TOKEN")

printf '%s' "$URL_RESCAN" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.status!=="COMPLETED" || j.reason!=="MANUAL_RESCAN" || j.provider!=="development") process.exit(1); console.log("URL manual rescan ok");});
'


SEARCH_FILE=$(curl -fsS "$BASE_URL/artifacts/search?q=sample.txt")
printf '%s' "$SEARCH_FILE" | ARTIFACT_ID="$ARTIFACT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || !j.some(x=>x.id===process.env.ARTIFACT_ID && x.type==="FILE")) process.exit(1); console.log("public file search ok");});
'

SEARCH_URL=$(curl -fsS "$BASE_URL/artifacts/search?q=example.com")
printf '%s' "$SEARCH_URL" | URL_ARTIFACT_ID="$URL_ARTIFACT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || !j.some(x=>x.id===process.env.URL_ARTIFACT_ID && x.type==="URL")) process.exit(1); console.log("public URL search ok");});
'

OWN_HISTORY=$(curl -fsS "$BASE_URL/users/me/history" \
  -H "Authorization: Bearer $TOKEN")
printf '%s' "$OWN_HISTORY" | ARTIFACT_ID="$ARTIFACT_ID" URL_ARTIFACT_ID="$URL_ARTIFACT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j)) process.exit(1); if(!j.some(x=>x.artifactId===process.env.ARTIFACT_ID && x.artifactType==="FILE")) process.exit(1); if(!j.some(x=>x.artifactId===process.env.URL_ARTIFACT_ID && x.artifactType==="URL")) process.exit(1); console.log("user submission history ok");});
'

echo "public artifact search ok"

ADVANCED_SEARCH=$(curl -fsS "$BASE_URL/artifacts/search/advanced?q=sample.txt&type=FILE&verdict=UNKNOWN&sort=LAST_SEEN_DESC&page=1&pageSize=1")

printf '%s' "$ADVANCED_SEARCH" | ARTIFACT_ID="$ARTIFACT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j.items) || j.items.length!==1) process.exit(1); if(j.items[0].id!==process.env.ARTIFACT_ID) process.exit(1); if(j.page!==1 || j.pageSize!==1 || j.total<1 || j.totalPages<1) process.exit(1); if(j.filters?.type!=="FILE" || j.filters?.verdict!=="UNKNOWN") process.exit(1); console.log("advanced artifact search ok");});
'

API_KEY_CREATED=$(curl -fsS -X POST "$BASE_URL/api-keys" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"CI public API"}')

PUBLIC_API_KEY=$(printf '%s' "$API_KEY_CREATED" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id || !j.key || !j.key.startsWith("gv_") || !j.keyPrefix) process.exit(1); process.stdout.write(j.key);});
')

API_KEY_ID=$(printf '%s' "$API_KEY_CREATED" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id) process.exit(1); process.stdout.write(j.id);});
')

curl -fsS "$BASE_URL/api-keys" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || !j.some(x=>x.name==="CI public API" && x.keyPrefix && !("key" in x))) process.exit(1); console.log("API key list hides plaintext ok");});
'

curl -fsS "$BASE_URL/api/v1/search?q=sample.txt" \
  -H "X-API-Key: $PUBLIC_API_KEY" \
  | ARTIFACT_ID="$ARTIFACT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || !j.some(x=>x.id===process.env.ARTIFACT_ID)) process.exit(1); console.log("public API search ok");});
'

API_URL_UPLOAD=$(curl -fsS -X POST "$BASE_URL/api/v1/urls" \
  -H "X-API-Key: $PUBLIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://api.example.com/from-key"}')

API_URL_ARTIFACT_ID=$(printf '%s' "$API_URL_UPLOAD" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.artifact?.id || j.submission?.visibility!=="PUBLIC" || j.scan?.reason!=="API_REQUEST") process.exit(1); process.stdout.write(j.artifact.id);});
')

API_URL_SUBMISSION_ID=$(printf '%s' "$API_URL_UPLOAD" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.submission?.id) process.exit(1); process.stdout.write(j.submission.id);});
')

curl -fsS -X PUT "$BASE_URL/api/v1/artifacts/$API_URL_ARTIFACT_ID/rescan" \
  -H "X-API-Key: $PUBLIC_API_KEY" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.reason!=="MANUAL_RESCAN") process.exit(1);});
'


curl -fsS "$BASE_URL/api/v1/artifacts/$API_URL_ARTIFACT_ID" \
  -H "X-API-Key: $PUBLIC_API_KEY" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.type!=="URL" || j.url?.domain!=="api.example.com") process.exit(1); console.log("public API artifact lookup ok");});
'

curl -fsS -X DELETE "$BASE_URL/api/v1/submissions/$API_URL_SUBMISSION_ID" \
  -H "X-API-Key: $PUBLIC_API_KEY" \
  | API_URL_ARTIFACT_ID="$API_URL_ARTIFACT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.success!==true || j.artifactId!==process.env.API_URL_ARTIFACT_ID) process.exit(1); console.log("public API PUT/DELETE ok");});
'

printf 'public api file\n' >/tmp/api-sample.txt
API_FILE_UPLOAD=$(curl -fsS -X POST "$BASE_URL/api/v1/files" \
  -H "X-API-Key: $PUBLIC_API_KEY" \
  -F "file=@/tmp/api-sample.txt;type=text/plain")

printf '%s' "$API_FILE_UPLOAD" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.artifact?.type!=="FILE" || j.submission?.visibility!=="PUBLIC" || j.scan?.reason!=="API_REQUEST") process.exit(1); console.log("public API file submission ok");});
'

curl -fsS "$BASE_URL/users/me/history" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || !j.some(x=>x.source==="API")) process.exit(1); console.log("API submission source history ok");});
'

echo "API key management and public API ok"


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


COMMENT_ID=$(printf '%s' "$COMMENT" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id) process.exit(1); process.stdout.write(j.id);});
')

EDIT_COMMENT=$(curl -fsS -X POST "$BASE_URL/artifacts/$ARTIFACT_ID/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"CI edit-delete comment"}')

EDIT_COMMENT_ID=$(printf '%s' "$EDIT_COMMENT" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id) process.exit(1); process.stdout.write(j.id);});
')

curl -fsS -X PATCH "$BASE_URL/artifacts/$ARTIFACT_ID/comments/$EDIT_COMMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"CI edited comment"}' \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.body!=="CI edited comment" || !j.editedAt) process.exit(1);});
'

curl -fsS -X DELETE "$BASE_URL/artifacts/$ARTIFACT_ID/comments/$EDIT_COMMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.success!==true) process.exit(1); console.log("comment edit/delete ok");});
'

curl -fsS "$BASE_URL/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); const types=new Set(j.map(x=>x.type)); if(!types.has("RESOURCE_CREATED") || !types.has("RESOURCE_UPDATED") || !types.has("RESOURCE_DELETED")) process.exit(1); console.log("comment lifecycle notifications ok");});
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


curl -fsS "$BASE_URL/artifacts/search?q=private-sample.txt" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || j.length!==0) process.exit(1); console.log("private artifact excluded from search ok");});
'

curl -fsS "$BASE_URL/users/me/history" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || !j.some(x=>x.displayName==="private-sample.txt" && x.visibility==="PRIVATE")) process.exit(1); console.log("private artifact included in owner history ok");});
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

curl -fsS -X POST "$BASE_URL/artifacts/$ARTIFACT_ID/comments" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"body\":\"CI reply notification\",\"parentId\":\"$COMMENT_ID\"}" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id || !j.parentId) process.exit(1);});
'

curl -fsS "$BASE_URL/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.some(x=>x.type==="COMMENT_REPLY")) process.exit(1); console.log("comment reply notification ok");});
'

VIEWER_COMMENT_ID=$(curl -fsS -X POST "$BASE_URL/artifacts/$ARTIFACT_ID/comments" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"CI submission comment notification"}' \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id || j.parentId) process.exit(1); process.stdout.write(j.id);});
')

curl -fsS "$BASE_URL/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  | COMMENT_ID="$VIEWER_COMMENT_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.some(x=>x.type==="COMMENT_RECEIVED" && x.commentId===process.env.COMMENT_ID)) process.exit(1); console.log("submission comment notification ok");});
'

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


REPORT=$(curl -fsS -X POST "$BASE_URL/artifacts/$ARTIFACT_ID/comments/$COMMENT_ID/report" \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"SPAM","details":"CI moderation test"}')

REPORT_ID=$(printf '%s' "$REPORT" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.id || j.reason!=="SPAM" || j.status!=="OPEN") process.exit(1); process.stdout.write(j.id);});
')

echo "moderation report created ok"

MODERATION_FORBIDDEN=$(curl -sS -o /tmp/moderation-forbidden.json -w "%{http_code}" \
  "$BASE_URL/moderation/reports?status=OPEN" \
  -H "Authorization: Bearer $VIEWER_TOKEN")

if [ "$MODERATION_FORBIDDEN" != "403" ]; then
  echo "normal user moderation access should return 403, got $MODERATION_FORBIDDEN"
  cat /tmp/moderation-forbidden.json
  exit 1
fi

echo "moderation role guard ok"


ADMIN_FORBIDDEN=$(curl -sS -o /tmp/admin-forbidden.json -w "%{http_code}" \
  "$BASE_URL/admin/overview" \
  -H "Authorization: Bearer $TOKEN")

if [ "$ADMIN_FORBIDDEN" != "403" ]; then
  echo "normal user admin access should return 403, got $ADMIN_FORBIDDEN"
  cat /tmp/admin-forbidden.json
  exit 1
fi

echo "admin role guard ok"

docker compose exec -T postgres psql \
  -U transcendence \
  -d transcendence \
  -c "UPDATE users SET role = 'ADMIN' WHERE email = 'ci@example.com';" \
  >/dev/null

ADMIN_OVERVIEW=$(curl -fsS "$BASE_URL/admin/overview" \
  -H "Authorization: Bearer $TOKEN")

printf '%s' "$ADMIN_OVERVIEW" | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(typeof j.community?.votes!=="number" || typeof j.users?.onlineNow!=="number") process.exit(1);});
'

curl -fsS "$BASE_URL/admin/activity?days=1" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || j.length!==1) process.exit(1);});
'

TODAY=$(node -e 'process.stdout.write(new Date().toISOString().slice(0,10))')

curl -fsS "$BASE_URL/admin/activity?from=$TODAY&to=$TODAY" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!Array.isArray(j) || j.length!==1) process.exit(1);});
'

curl -fsS "$BASE_URL/admin/export.csv?from=$TODAY&to=$TODAY" \
  -H "Authorization: Bearer $TOKEN" \
  | grep -q '"community_votes"'

curl -fsS "$BASE_URL/admin/export.pdf?from=$TODAY&to=$TODAY" \
  -H "Authorization: Bearer $TOKEN" \
  -o /tmp/admin-analytics.pdf

head -c 4 /tmp/admin-analytics.pdf | grep -q '%PDF'

echo "advanced admin analytics ok"

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

curl -fsS -X DELETE "$BASE_URL/api-keys/$API_KEY_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.success!==true) process.exit(1);});
'

REVOKED_API_CODE=$(curl -sS -o /tmp/revoked-api-key.json -w "%{http_code}" \
  "$BASE_URL/api/v1/search?q=sample.txt" \
  -H "X-API-Key: $PUBLIC_API_KEY")

if [ "$REVOKED_API_CODE" != "401" ]; then
  echo "revoked API key should return 401, got $REVOKED_API_CODE"
  cat /tmp/revoked-api-key.json
  exit 1
fi

echo "revoked API key rejected ok"

OWN_SUBMISSION_ID=$(curl -fsS "$BASE_URL/users/me/history" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); const item=j.find(x=>x.displayName==="private-sample.txt"); if(!item) process.exit(1); process.stdout.write(item.id);});
')

OWN_DELETE=$(curl -fsS -X DELETE "$BASE_URL/artifacts/submissions/$OWN_SUBMISSION_ID" \
  -H "Authorization: Bearer $TOKEN")

printf '%s' "$OWN_DELETE" | OWN_SUBMISSION_ID="$OWN_SUBMISSION_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.success!==true || j.submissionId!==process.env.OWN_SUBMISSION_ID) process.exit(1); console.log("own submission deleted ok");});
'

curl -fsS "$BASE_URL/users/me/history" \
  -H "Authorization: Bearer $TOKEN" \
  | OWN_SUBMISSION_ID="$OWN_SUBMISSION_ID" node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(j.some(x=>x.id===process.env.OWN_SUBMISSION_ID)) process.exit(1); console.log("deleted submission left the history ok");});
'

curl -fsS "$BASE_URL/notifications" \
  -H "Authorization: Bearer $TOKEN" \
  | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s); if(!j.some(x=>x.message==="Your submission was deleted." && x.type==="RESOURCE_DELETED")) process.exit(1); console.log("submission deletion notification ok");});
'

OWN_DELETE_AGAIN_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/artifacts/submissions/$OWN_SUBMISSION_ID" \
  -H "Authorization: Bearer $TOKEN")

if [ "$OWN_DELETE_AGAIN_CODE" != "404" ]; then
  echo "deleting a submission twice should return 404, got $OWN_DELETE_AGAIN_CODE"
  exit 1
fi

echo "second delete rejected ok"

AI_LIMITED=0
for _ in $(seq 1 15); do
  AI_LIMIT_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/ai/ask" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"prompt":"What is a trojan?"}')
  if [ "$AI_LIMIT_CODE" = "429" ]; then
    AI_LIMITED=1
    break
  fi
done

if [ "$AI_LIMITED" -ne 1 ]; then
  echo "the AI route should answer 429 after too many requests"
  exit 1
fi

echo "AI rate limit ok"

TABLE_COUNT=$(docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM pg_tables WHERE schemaname = '\''public'\'';"')

if [ "$TABLE_COUNT" -lt 19 ]; then
  echo "Expected at least 19 application tables, found $TABLE_COUNT"
  exit 1
fi

echo "database tables ok: $TABLE_COUNT"

MIGRATION_COUNT=$(docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT count(*) FROM \"_prisma_migrations\" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;"')

if [ "$MIGRATION_COUNT" -ne 5 ]; then
  echo "Expected exactly 5 applied Prisma migrations, found $MIGRATION_COUNT"
  exit 1
fi

echo "Prisma migration history ok"
echo "SMOKE TEST PASSED"
