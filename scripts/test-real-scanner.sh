#!/usr/bin/env bash
set -euo pipefail

export COMPOSE_PROJECT_NAME="\${COMPOSE_PROJECT_NAME:-go-virus-real-test}"
export POSTGRES_PORT="\${POSTGRES_PORT:-55432}"
export BACKEND_PORT="\${BACKEND_PORT:-3100}"
export FRONTEND_PORT="\${FRONTEND_PORT:-5273}"
export SCAN_PROVIDER=real
export VIRUSTOTAL_API_KEY=

BASE_URL="http://localhost:\${BACKEND_PORT}"

cleanup() {
  docker compose \
    --env-file .env.example \
    --profile real-scan \
    down -v || true
}
trap cleanup EXIT

docker compose \
  --env-file .env.example \
  --profile real-scan \
  up --build -d

echo "Waiting for backend..."
for _ in $(seq 1 120); do
  if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Waiting for ClamAV signatures and daemon..."
scanner_ready=0
for _ in $(seq 1 180); do
  if curl -fsS "$BASE_URL/artifacts/scanner/capabilities" \
    | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  const clam=j.engines?.find(x=>x.name==="clamav");
  if(j.provider!=="real" || !clam?.configured) process.exit(1);
});
' >/dev/null 2>&1; then
    scanner_ready=1
    break
  fi
  sleep 2
done

if [ "$scanner_ready" -ne 1 ]; then
  echo "ClamAV never became ready"
  docker compose \
    --env-file .env.example \
    --profile real-scan \
    logs --no-color clamav backend
  exit 1
fi

echo "ClamAV ready"

suffix="$(date +%s)"
email="real-scan-\${suffix}@example.com"
username="realscan\${suffix}"

curl -fsS -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$username\",\"email\":\"$email\",\"password\":\"password123\"}" \
  >/dev/null

LOGIN=$(curl -fsS -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$email\",\"password\":\"password123\"}")

TOKEN=$(printf '%s' "$LOGIN" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  if(!j.token) process.exit(1);
  process.stdout.write(j.token);
});
')

printf 'This is a clean GO VIRUS ClamAV integration test.\n' >/tmp/go-virus-clean.txt

CLEAN=$(curl -fsS -X POST "$BASE_URL/artifacts/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/go-virus-clean.txt;type=text/plain" \
  -F "visibility=PRIVATE")

printf '%s' "$CLEAN" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  const local=j.scan?.engineResults?.find(x=>x.engine==="ClamAV (local)");
  if(j.scan?.status!=="COMPLETED") process.exit(1);
  if(j.scan?.provider!=="real") process.exit(1);
  if(local?.verdict!=="HARMLESS") process.exit(1);
  console.log("clean ClamAV scan ok");
});
'

# Build the harmless EICAR test file at runtime without storing the full
# signature as one contiguous string in this repository.
printf '%s%s' \
  'X5O!P%@AP[4\PZX54(P^)7CC)7}$' \
  'EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*' \
  >/tmp/go-virus-eicar.com

MALWARE=$(curl -fsS -X POST "$BASE_URL/artifacts/files" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/go-virus-eicar.com;type=application/octet-stream" \
  -F "visibility=PRIVATE" \
  -F "forceRescan=true")

printf '%s' "$MALWARE" | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  const local=j.scan?.engineResults?.find(x=>x.engine==="ClamAV (local)");
  if(j.scan?.status!=="COMPLETED") process.exit(1);
  if(j.scan?.overallVerdict!=="MALICIOUS") process.exit(1);
  if(local?.verdict!=="MALICIOUS") process.exit(1);
  if(!local?.detectionName) process.exit(1);
  console.log("EICAR ClamAV detection ok:", local.detectionName);
});
'

echo "REAL CLAMAV SCANNER TEST PASSED"
