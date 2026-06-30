/**
 * @atlas
 * @kind utils
 * @uses primitive:shared
 */
import { BRACKET_SYMBOL_SEGMENT, castBracketSymbol } from '@template/shared/bracketQuery';

export type BracketQueryPrimitive = string | number | boolean | null;
export type BracketQueryValue = BracketQueryPrimitive | BracketQueryPrimitive[] | BracketQueryRecord;
export type BracketQueryRecord = {
  [key: string]: BracketQueryValue | undefined;
};

export const parseBracketNotation = (url: string): BracketQueryRecord => {
  const params = new URLSearchParams(url.split('?')[1] || '');
  const result: BracketQueryRecord = {};

  for (const [key, value] of params.entries()) {
    const bracketMatch = key.match(/^([^[]+)(\[[^\]]+\])+$/);
    if (!bracketMatch) continue;

    const rawKeys = key.match(/[^[\]]+/g);
    if (!rawKeys || rawKeys.length < 2) continue;

    // A trailing `[:]` marks the leaf value as a symbol (null/true/false) rather
    // than a literal string; drop the marker and cast the value.
    const isSymbol = rawKeys[rawKeys.length - 1] === BRACKET_SYMBOL_SEGMENT;
    const keys = isSymbol ? rawKeys.slice(0, -1) : rawKeys;
    if (keys.length < 1) continue;

    let current: BracketQueryRecord = result;
    for (let i = 0; i < keys.length - 1; i++) {
      const currentValue = current[keys[i]];
      if (typeof currentValue !== 'object' || currentValue === null || Array.isArray(currentValue)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]] as BracketQueryRecord;
    }

    const decoded = decodeURIComponent(value.replace(/\+/g, ' ')).trim();
    // Cast `[:]`-marked tokens to symbols; unknown tokens fall back to the literal
    // string (allowlist, no eval). `=== undefined` so the valid null symbol survives.
    const symbol = isSymbol ? castBracketSymbol(decoded) : undefined;
    // A `[:]` marker with a value that isn't a valid symbol (null/true/false) is
    // malformed — skip it rather than silently storing the raw string.
    if (isSymbol && symbol === undefined) continue;
    const decodedValue: BracketQueryPrimitive = symbol !== undefined ? symbol : decoded;
    const leafKey = keys[keys.length - 1];
    const existingValue = current[leafKey];

    if (existingValue === undefined) {
      current[leafKey] = decodedValue;
      continue;
    }

    if (Array.isArray(existingValue)) {
      existingValue.push(decodedValue);
      continue;
    }

    current[leafKey] = [existingValue as BracketQueryPrimitive, decodedValue];
  }

  return result;
};
