import {
  existsSync,
  readFileSync,
} from 'fs';
import { isAbsolute } from 'path';

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

    if (!isAbsolute(filePath)) {
      throw new Error(
        name +
          '_FILE must be an absolute mounted file path. ' +
          'Put the secret value in ' +
          name +
          ' instead.',
      );
    }

    if (!existsSync(filePath)) {
      throw new Error(
        name +
          '_FILE points to a missing mounted secret file.',
      );
    }

    const value = readFileSync(
      filePath,
      'utf8',
    ).trim();

    if (!value) {
      throw new Error(
        name +
          '_FILE points to an empty secret file.',
      );
    }

    process.env[name] = value;
  }
}
