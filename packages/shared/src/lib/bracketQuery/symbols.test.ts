import { describe, expect, it } from 'bun:test';
import { bracketSymbolToken, castBracketSymbol, isBracketSymbol } from '@template/shared/bracketQuery';

describe('bracket symbols', () => {
  it('castBracketSymbol allowlists null/true/false only', () => {
    expect(castBracketSymbol('null')).toBe(null);
    expect(castBracketSymbol('true')).toBe(true);
    expect(castBracketSymbol('false')).toBe(false);
    expect(castBracketSymbol('NULL')).toBeUndefined();
    expect(castBracketSymbol('anything')).toBeUndefined();
  });

  it('isBracketSymbol matches null + booleans, not their string forms', () => {
    expect(isBracketSymbol(null)).toBe(true);
    expect(isBracketSymbol(true)).toBe(true);
    expect(isBracketSymbol(false)).toBe(true);
    expect(isBracketSymbol('null')).toBe(false);
    expect(isBracketSymbol(0)).toBe(false);
  });

  it('bracketSymbolToken round-trips through castBracketSymbol', () => {
    expect(bracketSymbolToken(null)).toBe('null');
    expect(castBracketSymbol(bracketSymbolToken(true))).toBe(true);
    expect(castBracketSymbol(bracketSymbolToken(false))).toBe(false);
  });
});
