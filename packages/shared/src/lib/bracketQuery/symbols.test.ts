import { describe, expect, it } from 'bun:test';
import {
  bracketNumberToken,
  bracketSymbolToken,
  castBracketNumber,
  castBracketSymbol,
  isBracketNumber,
  isBracketSymbol,
} from '@template/shared/bracketQuery';

describe('bracket symbols', () => {
  it('castBracketSymbol allowlists the symbol spellings only', () => {
    expect(castBracketSymbol('null')).toBe(null);
    expect(castBracketSymbol('true')).toBe(true);
    expect(castBracketSymbol('false')).toBe(false);
    expect(castBracketSymbol('NULL')).toBeUndefined();
    expect(castBracketSymbol('anything')).toBeUndefined();
  });

  it('castBracketSymbol accepts lenient boolean spellings (0/1/t/f)', () => {
    expect(castBracketSymbol('1')).toBe(true);
    expect(castBracketSymbol('0')).toBe(false);
    expect(castBracketSymbol('t')).toBe(true);
    expect(castBracketSymbol('f')).toBe(false);
    expect(castBracketSymbol('T')).toBeUndefined();
    expect(castBracketSymbol('yes')).toBeUndefined();
    expect(castBracketSymbol('2')).toBeUndefined();
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

describe('bracket numbers', () => {
  it('castBracketNumber casts finite numeric tokens', () => {
    expect(castBracketNumber('42')).toBe(42);
    expect(castBracketNumber('-3.5')).toBe(-3.5);
    expect(castBracketNumber('0')).toBe(0);
    expect(castBracketNumber('1e3')).toBe(1000);
  });

  it('castBracketNumber rejects non-numeric / non-finite tokens', () => {
    expect(castBracketNumber('')).toBeUndefined();
    expect(castBracketNumber('abc')).toBeUndefined();
    expect(castBracketNumber('NaN')).toBeUndefined();
    expect(castBracketNumber('Infinity')).toBeUndefined();
    expect(castBracketNumber('42abc')).toBeUndefined();
  });

  it('isBracketNumber matches finite numbers only', () => {
    expect(isBracketNumber(42)).toBe(true);
    expect(isBracketNumber(0)).toBe(true);
    expect(isBracketNumber(Number.NaN)).toBe(false);
    expect(isBracketNumber(Number.POSITIVE_INFINITY)).toBe(false);
    expect(isBracketNumber('42')).toBe(false);
    expect(isBracketNumber(true)).toBe(false);
  });

  it('bracketNumberToken round-trips through castBracketNumber', () => {
    expect(castBracketNumber(bracketNumberToken(42))).toBe(42);
    expect(castBracketNumber(bracketNumberToken(-0.25))).toBe(-0.25);
  });
});
