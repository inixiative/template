/**
 * @atlas
 * @partOf primitive:ui
 */
import { BRACKET_SYMBOL_SEGMENT, bracketSymbolToken, isBracketSymbol } from '@template/shared/bracketQuery';

export const serializeBracketQuery = (obj: Record<string, unknown>, prefix = ''): URLSearchParams => {
  const params = new URLSearchParams();
  const append = (key: string, val: unknown) => {
    if (Array.isArray(val)) {
      for (const item of val) params.append(key, String(item));
    } else if (val !== null && typeof val === 'object') {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        append(`${key}[${k}]`, v);
      }
    } else if (isBracketSymbol(val)) {
      // null / true / false → `[:]` marker so the server casts to a symbol, not a string.
      params.append(`${key}[${BRACKET_SYMBOL_SEGMENT}]`, bracketSymbolToken(val));
    } else if (val !== undefined) {
      params.append(key, String(val));
    }
  };
  for (const [k, v] of Object.entries(obj)) {
    append(prefix ? `${prefix}[${k}]` : k, v);
  }
  return params;
};
