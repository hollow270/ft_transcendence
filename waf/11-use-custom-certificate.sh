#!/bin/sh
set -eu

CERT_SOURCE=/run/go-virus-tls/server.crt
KEY_SOURCE=/run/go-virus-tls/server.key
CERT_TARGET=/etc/nginx/conf/server.crt
KEY_TARGET=/etc/nginx/conf/server.key

if [ -f "$CERT_SOURCE" ] && [ -f "$KEY_SOURCE" ]; then
  echo "GO VIRUS: using mounted TLS certificate"
  cp "$CERT_SOURCE" "$CERT_TARGET"
  cp "$KEY_SOURCE" "$KEY_TARGET"
  chmod 600 "$KEY_TARGET"
  chmod 644 "$CERT_TARGET"
else
  echo "GO VIRUS: using WAF-generated local TLS certificate"
fi
