#!/bin/sh
set -eu

CERT_SOURCE=/run/go-virus-tls/server.crt
KEY_SOURCE=/run/go-virus-tls/server.key
CERT_TARGET=/etc/nginx/conf/server.crt
KEY_TARGET=/etc/nginx/conf/server.key

if [ -f "$CERT_SOURCE" ] && [ -f "$KEY_SOURCE" ]; then
  if [ -r "$CERT_SOURCE" ] && [ -r "$KEY_SOURCE" ]; then
    echo "GO VIRUS: preloading mounted TLS certificate"
    mkdir -p /etc/nginx/conf
    cp "$CERT_SOURCE" "$CERT_TARGET"
    cp "$KEY_SOURCE" "$KEY_TARGET"
    chmod 600 "$KEY_TARGET"
    chmod 644 "$CERT_TARGET"
  else
    echo "GO VIRUS: waf/tls/server.crt and waf/tls/server.key are not readable inside the container, using the generated self-signed certificate"
    echo "GO VIRUS: run chmod 644 waf/tls/server.key waf/tls/server.crt and recreate the waf service"
  fi
fi

exec /docker-entrypoint.sh "$@"
