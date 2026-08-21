/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import {
  BRACKET_NUMBER_SEGMENT,
  BRACKET_SYMBOL_SEGMENT,
  bracketNumberToken,
  bracketSymbolToken,
  isBracketNumber,
  isBracketSymbol,
} from '@template/shared/bracketQuery';

export const serializeBracketQuery = (obj: Record<string, unknown>, prefix = ''): URLSearchParams => {
  const params = new URLSearchParams();
  // Typed leaf encoding, shared by bare values and array items. Numbers are only
  // marked when nested — top-level scalars (page, pageSize) must stay plain params
  // (hey-api-default-compatible, zod-coerced server-side), not move into the
  // bracketQuery record.
  const appendScalar = (key: string, val: unknown) => {
    if (isBracketSymbol(val)) {
      params.append(`${key}[${BRACKET_SYMBOL_SEGMENT}]`, bracketSymbolToken(val));
    } else if (isBracketNumber(val) && key.includes('[')) {
      params.append(`${key}[${BRACKET_NUMBER_SEGMENT}]`, bracketNumberToken(val));
    } else if (val !== undefined) {
      params.append(key, String(val));
    }
  };
  const append = (key: string, val: unknown) => {
    if (Array.isArray(val)) {
      for (const item of val) appendScalar(key, item);
    } else if (val !== null && typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        append(`${key}[${k}]`, v);
      }
    } else {
      appendScalar(key, val);
    }
  };
  for (const [k, v] of Object.entries(obj)) {
    append(prefix ? `${prefix}[${k}]` : k, v);
  }
  return params;
};
