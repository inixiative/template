// Bracket-query values are string-only on the wire, so a trailing `[:]` marker
// segment distinguishes a SYMBOL value (null / true / false) from the literal
// string of the same text. Allowlist — never eval / JSON.parse.
export const BRACKET_SYMBOL_SEGMENT = ':';

const SYMBOLS = { null: null, true: true, false: false } as const;

export type BracketSymbol = (typeof SYMBOLS)[keyof typeof SYMBOLS]; // null | boolean

// Decode a `[:]`-marked token → its symbol, or undefined if not an allowed symbol.
export const castBracketSymbol = (token: string): BracketSymbol | undefined =>
  token in SYMBOLS ? SYMBOLS[token as keyof typeof SYMBOLS] : undefined;

export const isBracketSymbol = (value: unknown): value is BracketSymbol => value === null || typeof value === 'boolean';

// Encode a symbol back to its wire token (null → "null", true → "true").
export const bracketSymbolToken = (value: BracketSymbol): string => String(value);
