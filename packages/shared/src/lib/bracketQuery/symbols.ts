/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
// Bracket-query values are string-only on the wire, so a trailing marker
// segment distinguishes a typed value from the literal string of the same
// text: `[:]` marks a SYMBOL (null / boolean), `[$]` marks a NUMBER.
// Allowlist — never eval / JSON.parse.
export const BRACKET_SYMBOL_SEGMENT = ':';

// `$` is the marker because the safe-in-a-raw-query alphabet is tiny: `#` starts
// the fragment, `+` decodes to space, `%` is the escape prefix, `!` trips shell
// history expansion in curl repros. `$` is an RFC 3986 sub-delim that survives
// hand-typed URLs untouched.
export const BRACKET_NUMBER_SEGMENT = '$';

// Lenient parse-side spellings; the serializer only ever emits the canonical
// null/true/false tokens.
const SYMBOLS = { null: null, true: true, false: false, '1': true, '0': false, t: true, f: false } as const;

export type BracketSymbol = (typeof SYMBOLS)[keyof typeof SYMBOLS]; // null | boolean

// Decode a `[:]`-marked token → its symbol, or undefined if not an allowed symbol.
export const castBracketSymbol = (token: string): BracketSymbol | undefined =>
  token in SYMBOLS ? SYMBOLS[token as keyof typeof SYMBOLS] : undefined;

export const isBracketSymbol = (value: unknown): value is BracketSymbol => value === null || typeof value === 'boolean';

// Encode a symbol back to its wire token (null → "null", true → "true").
export const bracketSymbolToken = (value: BracketSymbol): string => String(value);

// Decode a `[$]`-marked token → its number, or undefined if not a finite number.
export const castBracketNumber = (token: string): number | undefined => {
  if (token === '') return undefined;
  const value = Number(token);
  return Number.isFinite(value) ? value : undefined;
};

// NaN / Infinity are excluded: they have no finite wire token, so they serialize
// as plain strings rather than a marker the parser would drop.
export const isBracketNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const bracketNumberToken = (value: number): string => String(value);
