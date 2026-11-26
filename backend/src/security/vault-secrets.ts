import { readFileSync } from 'fs';

const VAULT_SECRET_NAMES = [
  'VIRUSTOTAL_API_KEY',
  'OPENAI_API_KEY',
  'TWO_FACTOR_ENCRYPTION_KEY',
  'CLAIM_TOKEN_SECRET',
] as const;

const VAULT_SECRET_PATH = 'secret/data/go-virus/backend';
const VAULT_ATTEMPTS = 10;
const VAULT_RETRY_DELAY_MS = 2000;

type VaultLoginResponse = {
  auth?: { client_token?: string };
};

type VaultSecretResponse = {
  data?: { data?: Record<string, unknown> };
};

function readMountedValue(variable: string) {
  const filePath = process.env[variable]?.trim();

  if (!filePath) {
    throw new Error(variable + ' must point to the mounted Vault credential file.');
  }

  const value = readFileSync(filePath, 'utf8').trim();

  if (!value) {
    throw new Error(variable + ' points to an empty file.');
  }

  return value;
}

async function vaultRequest<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error('Vault answered ' + response.status + ' for ' + new URL(url).pathname);
  }

  return (await response.json()) as T;
}

async function readSecrets(address: string) {
  const login = await vaultRequest<VaultLoginResponse>(address + '/v1/auth/approle/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role_id: readMountedValue('VAULT_ROLE_ID_FILE'),
      secret_id: readMountedValue('VAULT_SECRET_ID_FILE'),
    }),
  });

  const clientToken = login.auth?.client_token;

  if (!clientToken) {
    throw new Error('Vault did not return a client token.');
  }

  const secret = await vaultRequest<VaultSecretResponse>(address + '/v1/' + VAULT_SECRET_PATH, {
    headers: { 'X-Vault-Token': clientToken },
  });

  return secret.data?.data ?? {};
}

export async function loadVaultSecrets() {
  const address = process.env.VAULT_ADDR?.trim().replace(/\/$/, '');

  if (!address) {
    return false;
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= VAULT_ATTEMPTS; attempt += 1) {
    try {
      const values = await readSecrets(address);

      for (const name of VAULT_SECRET_NAMES) {
        const value = values[name];

        if (typeof value === 'string' && value.trim()) {
          process.env[name] = value.trim();
        }
      }

      return true;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, VAULT_RETRY_DELAY_MS));
    }
  }

  throw new Error(
    'Could not read secrets from Vault: ' +
      (lastError instanceof Error ? lastError.message : String(lastError)),
  );
}
