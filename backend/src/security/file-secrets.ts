import { readFileSync } from 'fs';

const FILE_SECRET_NAMES = [
  'VIRUSTOTAL_API_KEY',
  'OPENAI_API_KEY',
  'TWO_FACTOR_ENCRYPTION_KEY',
  'DATABASE_URL',
] as const;

export function loadFileSecrets() {
  for (const name of FILE_SECRET_NAMES) {
    const filePath =
      process.env[name + '_FILE']?.trim();

    if (!filePath) {
      continue;
    }

    const value = readFileSync(
      filePath,
      'utf8',
    ).trim();

    if (!value) {
      throw new Error(
        name + '_FILE points to an empty secret file',
      );
    }

    process.env[name] = value;
  }
}
