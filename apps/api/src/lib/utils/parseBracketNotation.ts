/**
 * @atlas
 * @kind utils
 * @uses primitive:shared
 */
import {
  BRACKET_NUMBER_SEGMENT,
  BRACKET_SYMBOL_SEGMENT,
  castBracketNumber,
  castBracketSymbol,
} from '@template/shared/bracketQuery';

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

    // A trailing marker segment types the leaf value: `[:]` = symbol (null/boolean),
    // `[$]` = number. Drop the marker from the key path and cast the value below.
    const lastSegment = rawKeys[rawKeys.length - 1];
    const marker =
      lastSegment === BRACKET_SYMBOL_SEGMENT ? 'symbol' : lastSegment === BRACKET_NUMBER_SEGMENT ? 'number' : undefined;
    const keys = marker ? rawKeys.slice(0, -1) : rawKeys;
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
    // Cast marked tokens through the allowlist (no eval); a marker whose value
    // doesn't cast is malformed — skip the leaf rather than silently storing the
    // raw string. `=== undefined` so the valid null symbol survives.
    const cast = marker === 'symbol' ? castBracketSymbol(decoded) : marker === 'number' ? castBracketNumber(decoded) : undefined;
    if (marker && cast === undefined) continue;
    const decodedValue: BracketQueryPrimitive = cast !== undefined ? cast : decoded;
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
