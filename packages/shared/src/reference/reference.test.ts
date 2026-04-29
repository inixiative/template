import { describe, expect, it } from 'bun:test';
import {
  callingCodeFor,
  COUNTRIES,
  COUNTRY_CODES,
  CountryCodeSchema,
  countryByCode,
  CURRENCIES,
  CURRENCY_CODES,
  CurrencyCodeSchema,
  decimalsFor,
  isCountryCode,
  isCurrencyCode,
  isLanguageCode,
  isTimezoneId,
  LANGUAGES,
  LanguageCodeSchema,
  TIMEZONE_IDS,
  TimezoneIdSchema,
  currentOffsetMinutes,
} from '@template/shared/reference';

const expectUniqueCodes = <T extends { code: string }>(rows: readonly T[]) => {
  const codes = rows.map((r) => r.code);
  expect(new Set(codes).size).toBe(codes.length);
};

describe('reference/countries', () => {
  it('has unique alpha-2 codes', () => expectUniqueCodes(COUNTRIES));

  it('every entry has name + numeric calling code', () => {
    for (const c of COUNTRIES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.callingCode).toMatch(/^\d{1,4}$/);
      expect(c.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('schema accepts known codes and rejects unknown', () => {
    expect(CountryCodeSchema.parse('US')).toBe('US');
    expect(CountryCodeSchema.parse('IL')).toBe('IL');
    expect(() => CountryCodeSchema.parse('ZZ')).toThrow();
    expect(() => CountryCodeSchema.parse('us')).toThrow();
  });

  it('lookups + helpers work', () => {
    expect(callingCodeFor('US')).toBe('1');
    expect(callingCodeFor('IL')).toBe('972');
    expect(countryByCode.get('CA')?.callingCode).toBe('1');
    expect(isCountryCode('GB')).toBe(true);
    expect(isCountryCode('XX')).toBe(false);
  });

  it('COUNTRY_CODES is in lockstep with COUNTRIES', () => {
    expect(COUNTRY_CODES.length).toBe(COUNTRIES.length);
  });
});

describe('reference/currencies', () => {
  it('has unique ISO-4217 codes', () => expectUniqueCodes(CURRENCIES));

  it('every entry has name, decimals 0-4, symbol', () => {
    for (const c of CURRENCIES) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.code).toMatch(/^[A-Z]{3}$/);
      expect(c.decimals).toBeGreaterThanOrEqual(0);
      expect(c.decimals).toBeLessThanOrEqual(4);
      expect(c.symbol.length).toBeGreaterThan(0);
    }
  });

  it('decimalsFor returns canonical minor units', () => {
    expect(decimalsFor('USD')).toBe(2);
    expect(decimalsFor('JPY')).toBe(0);
    expect(decimalsFor('BHD')).toBe(3);
    expect(decimalsFor('KWD')).toBe(3);
  });

  it('schema enforces enum', () => {
    expect(CurrencyCodeSchema.parse('USD')).toBe('USD');
    expect(() => CurrencyCodeSchema.parse('XYZ')).toThrow();
    expect(isCurrencyCode('EUR')).toBe(true);
    expect(isCurrencyCode('XYZ')).toBe(false);
  });

  it('CURRENCY_CODES is in lockstep with CURRENCIES', () => {
    expect(CURRENCY_CODES.length).toBe(CURRENCIES.length);
  });
});

describe('reference/languages', () => {
  it('has unique ISO-639-1 codes', () => expectUniqueCodes(LANGUAGES));

  it('every entry has name + nativeName + 2-char code', () => {
    for (const l of LANGUAGES) {
      expect(l.name.length).toBeGreaterThan(0);
      expect(l.nativeName.length).toBeGreaterThan(0);
      expect(l.code).toMatch(/^[a-z]{2}$/);
    }
  });

  it('schema accepts known + rejects unknown', () => {
    expect(LanguageCodeSchema.parse('en')).toBe('en');
    expect(LanguageCodeSchema.parse('he')).toBe('he');
    expect(() => LanguageCodeSchema.parse('xx')).toThrow();
    expect(isLanguageCode('he')).toBe(true);
    expect(isLanguageCode('xx')).toBe(false);
  });
});

describe('reference/timezones', () => {
  it('has unique IANA ids', () => {
    expect(new Set(TIMEZONE_IDS).size).toBe(TIMEZONE_IDS.length);
  });

  it('schema accepts canonical zones + rejects unknown', () => {
    expect(TimezoneIdSchema.parse('America/New_York')).toBe('America/New_York');
    expect(TimezoneIdSchema.parse('Asia/Jerusalem')).toBe('Asia/Jerusalem');
    expect(TimezoneIdSchema.parse('UTC')).toBe('UTC');
    expect(() => TimezoneIdSchema.parse('Mars/Olympus')).toThrow();
    expect(isTimezoneId('Europe/London')).toBe(true);
    expect(isTimezoneId('US/Pacific')).toBe(false); // alias, not canonical
  });

  it('currentOffsetMinutes returns a sensible offset for UTC', () => {
    expect(currentOffsetMinutes('UTC')).toBe(0);
  });

  it('currentOffsetMinutes returns -ve for Americas, +ve for Asia', () => {
    // Americas/New_York is UTC-5 or -4 depending on DST. Asia/Tokyo is +9 always.
    expect(currentOffsetMinutes('America/New_York')).toBeLessThan(0);
    expect(currentOffsetMinutes('Asia/Tokyo')).toBe(540);
  });
});
