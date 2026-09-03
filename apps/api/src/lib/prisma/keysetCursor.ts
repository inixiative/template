/**
 * @atlas
 * @kind utils
 * @partOf infrastructure:prisma
 * @uses none
 */
import { makeError } from '#/lib/errors';
import { lookupField } from '#/lib/prisma/fieldMetadata';

export type SortDirection = 'asc' | 'desc';
export type SortKey = readonly [string, SortDirection];

const CURSOR_VERSION = 1;

type DecodedCursor = { v: number; k: SortKey[]; p: unknown[] };

// Dates and BigInts have no JSON representation that survives a round trip, and both are
// legitimate sort keys.
const replacer = (_key: string, value: unknown) =>
  value instanceof Date ? value.toISOString() : typeof value === 'bigint' ? value.toString() : value;

export const encodeCursor = (chain: SortKey[], values: unknown[]): string => {
  const payload: DecodedCursor = { v: CURSOR_VERSION, k: chain, p: values };
  return Buffer.from(JSON.stringify(payload, replacer)).toString('base64url');
};

export const decodeCursor = (cursor: string): DecodedCursor => {
  let parsed: DecodedCursor;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw makeError({ status: 400, message: 'Malformed pagination cursor' });
  }
  if (
    parsed?.v !== CURSOR_VERSION ||
    !Array.isArray(parsed.k) ||
    !parsed.k.every(
      (el): el is SortKey => Array.isArray(el) && typeof el[0] === 'string' && (el[1] === 'asc' || el[1] === 'desc'),
    ) ||
    !Array.isArray(parsed.p) ||
    !parsed.p.every((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') ||
    // why: cursor value count must equal key-chain length — a mismatch silently drops the
    // why: filter and traps the caller on page 1 forever.
    parsed.p.length !== parsed.k.length ||
    new Set(parsed.k.map(([key]) => key)).size !== parsed.k.length
  ) {
    throw makeError({ status: 400, message: 'Unsupported pagination cursor' });
  }
  return parsed;
};

// A cursor arrives as JSON, so a BigInt column's boundary value comes back as a string and would
// compare as text.
export const hydrateCursorValues = (model: string, chain: SortKey[], values: unknown[]): unknown[] =>
  chain.map(([key], i) => {
    const value = values[i];
    if (lookupField(model, key)?.type !== 'BigInt' || typeof value === 'bigint' || value == null) return value;
    try {
      return BigInt(value as string | number);
    } catch {
      throw makeError({ status: 400, message: 'Unsupported pagination cursor' });
    }
  });

// why: cursor's sort-key chain must match the resolved sort exactly, or pagination silently
// why: skips or repeats rows.
export const assertChainMatches = (cursorChain: SortKey[], resolvedChain: SortKey[]): void => {
  const same =
    cursorChain.length === resolvedChain.length &&
    cursorChain.every(([key, dir], i) => {
      const resolved = resolvedChain[i];
      return resolved !== undefined && key === resolved[0] && dir === resolved[1];
    });
  if (!same) {
    throw makeError({ status: 400, message: 'Pagination cursor does not match the requested sort order' });
  }
};

// Prisma has no row-value comparison, so a composite keyset expands into an OR-chain: each clause
// pins every prior key to equality and compares the next one.
export const buildKeysetWhere = (chain: SortKey[], values: unknown[]): Record<string, unknown> => {
  const orClauses: Record<string, unknown>[] = [];
  chain.forEach(([key, dir], i) => {
    const clause: Record<string, unknown> = {};
    for (let j = 0; j < i; j++) {
      const [priorKey] = chain[j]!;
      clause[priorKey] = values[j];
    }
    clause[key] = dir === 'asc' ? { gt: values[i] } : { lt: values[i] };
    orClauses.push(clause);
  });
  return { OR: orClauses };
};
