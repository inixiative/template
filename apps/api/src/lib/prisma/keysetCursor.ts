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

const CURSOR_VERSION = 2;

type DecodedCursor = { v: number; k: SortKey[]; p: unknown[]; f: string };

// Dates and BigInts have no JSON representation that survives a round trip, and both are
// legitimate sort keys.
const replacer = (_key: string, value: unknown) =>
  value instanceof Date ? value.toISOString() : typeof value === 'bigint' ? value.toString() : value;

// The token is base64url-encoded and not signed — a client can hand-craft or edit one. It carries
// the sort chain and a hash of the composed filter, so decode fails closed on a sort-chain, arity
// or filter mismatch; the worst a tampered token buys is reseeking to a different offset inside
// data the caller may read anyway. Version 2 added the filter hash; there is no v1 fallback — a v1
// token has no filter to check, so it is rejected and the caller restarts the walk.
export const encodeCursor = (chain: SortKey[], values: unknown[], filterHash: string): string => {
  const payload: DecodedCursor = { v: CURSOR_VERSION, k: chain, p: values, f: filterHash };
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
    new Set(parsed.k.map(([key]) => key)).size !== parsed.k.length ||
    typeof parsed.f !== 'string'
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

// why: the cursor is only meaningful inside the sequence it was minted from. A different composed
// why: filter is a different sequence, so a replayed cursor seeks into the wrong rows silently.
export const assertFilterMatches = (cursorHash: string, resolvedHash: string): void => {
  if (cursorHash !== resolvedHash) {
    throw makeError({ status: 400, message: 'Pagination cursor does not match the requested filter' });
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
