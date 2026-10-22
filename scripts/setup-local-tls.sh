#!/usr/bin/env bash
set -euo pipefail

command -v mkcert >/dev/null 2>&1 || {
  echo "mkcert is required for a browser-trusted local certificate."
  echo "On macOS with Homebrew: brew install mkcert"
  exit 1
}

mkdir -p waf/tls

mkcert -install
mkcert   -cert-file waf/tls/server.crt   -key-file waf/tls/server.key   localhost 127.0.0.1 ::1

chmod 600 waf/tls/server.key
chmod 644 waf/tls/server.crt

echo "Trusted local TLS certificate created."
echo "Restart GO VIRUS with: docker compose up --build -d"
echo "Then open: https://localhost:${APP_HTTPS_PORT:-8443}"
