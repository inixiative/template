import { createHash } from 'node:crypto';
import stringify from 'safe-stable-stringify';

export const stableHash = (value: unknown): string =>
  createHash('sha256')
    .update(stringify(value) ?? '')
    .digest('hex')
    .slice(0, 16);
