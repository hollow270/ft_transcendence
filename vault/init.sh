#!/bin/sh
set -eu

KEYS_FILE=/vault/keys/init.env
APPROLE_DIR=/vault/approle
READY_FILE=/tmp/vault-ready
SECRET_PATH=secret/go-virus/backend
ROLE_NAME=go-virus-backend

export VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"

wait_for_vault() {
  attempts=0
  while :; do
    status_code=0
    vault status >/dev/null 2>&1 || status_code=$?
    [ "$status_code" -ne 1 ] && return 0
    attempts=$((attempts + 1))
    if [ "$attempts" -gt 60 ]; then
      echo "Vault did not answer in time"
      exit 1
    fi
    sleep 2
  done
}

is_initialized() {
  vault status 2>/dev/null | grep -Eq '^Initialized[[:space:]]+true'
}

is_sealed() {
  status_code=0
  vault status >/dev/null 2>&1 || status_code=$?
  [ "$status_code" -eq 2 ]
}

initialize() {
  echo "Initializing Vault"
  output="$(vault operator init -key-shares=1 -key-threshold=1)"
  unseal_key="$(printf '%s\n' "$output" | awk '/Unseal Key 1:/ { print $NF }')"
  root_token="$(printf '%s\n' "$output" | awk '/Initial Root Token:/ { print $NF }')"

  if [ -z "$unseal_key" ] || [ -z "$root_token" ]; then
    echo "Vault returned no keys"
    exit 1
  fi

  umask 077
  printf 'UNSEAL_KEY=%s\nROOT_TOKEN=%s\n' "$unseal_key" "$root_token" > "$KEYS_FILE"
}

unseal() {
  . "$KEYS_FILE"
  vault operator unseal "$UNSEAL_KEY" >/dev/null
  echo "Vault unsealed"
}

current_value() {
  vault kv get -field="$1" "$SECRET_PATH" 2>/dev/null || true
}

random_value() {
  head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n'
}

store_secrets() {
  set --
  for name in VIRUSTOTAL_API_KEY OPENAI_API_KEY TWO_FACTOR_ENCRYPTION_KEY CLAIM_TOKEN_SECRET; do
    eval "value=\${$name:-}"
    [ -n "$value" ] || value="$(current_value "$name")"

    if [ -z "$value" ]; then
      case "$name" in
        TWO_FACTOR_ENCRYPTION_KEY | CLAIM_TOKEN_SECRET) value="$(random_value)" ;;
      esac
    fi

    [ -z "$value" ] || set -- "$@" "$name=$value"
  done

  vault kv put "$SECRET_PATH" "$@" >/dev/null
  echo "Application secrets stored in Vault"
}

configure() {
  . "$KEYS_FILE"
  export VAULT_TOKEN="$ROOT_TOKEN"

  vault secrets list | grep -q '^secret/' || vault secrets enable -path=secret -version=2 kv >/dev/null
  vault policy write "$ROLE_NAME" /vault/init/backend-policy.hcl >/dev/null
  vault auth list | grep -q '^approle/' || vault auth enable approle >/dev/null

  vault write "auth/approle/role/$ROLE_NAME" \
    token_policies="$ROLE_NAME" \
    token_ttl=15m \
    token_max_ttl=1h \
    secret_id_ttl=0 >/dev/null

  store_secrets

  umask 077
  vault read -field=role_id "auth/approle/role/$ROLE_NAME/role-id" > "$APPROLE_DIR/role_id"
  vault write -f -field=secret_id "auth/approle/role/$ROLE_NAME/secret-id" > "$APPROLE_DIR/secret_id"
  echo "Backend credentials written"

  unset VAULT_TOKEN
}

wait_for_vault

if ! is_initialized; then
  initialize
fi

if is_sealed; then
  unseal
fi

configure
touch "$READY_FILE"
echo "Vault is ready"

while :; do
  sleep 10
  if is_sealed; then
    unseal
  fi
done
