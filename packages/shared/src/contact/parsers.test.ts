import { describe, expect, it } from 'bun:test';
import {
  canonicalUrl,
  parseGithubUrl,
  parseLinkedinUrl,
  parseTelegramUrl,
  parseTwitterUrl,
} from '@template/shared/contact/parsers';

describe('parseLinkedinUrl', () => {
  it('parses /in/ as personal', () => {
    expect(parseLinkedinUrl('https://linkedin.com/in/aron')).toEqual({
      classifier: 'personal',
      handle: 'aron',
    });
  });

  it('parses /company/ as company', () => {
    expect(parseLinkedinUrl('https://www.linkedin.com/company/anthropic')).toEqual({
      classifier: 'company',
      handle: 'anthropic',
    });
  });

  it('parses /school/ as school', () => {
    expect(parseLinkedinUrl('https://linkedin.com/school/mit/')).toEqual({
      classifier: 'school',
      handle: 'mit',
    });
  });

  it('drops query params and fragment', () => {
    expect(parseLinkedinUrl('https://linkedin.com/in/aron?trk=ref#about')).toEqual({
      classifier: 'personal',
      handle: 'aron',
    });
  });

  it('rejects unknown prefix', () => {
    expect(() => parseLinkedinUrl('https://linkedin.com/learning/x')).toThrow();
  });

  it('rejects non-linkedin host', () => {
    expect(() => parseLinkedinUrl('https://facebook.com/in/aron')).toThrow();
  });
});

describe('parseGithubUrl', () => {
  it('extracts handle, defaulting classifier to user', () => {
    expect(parseGithubUrl('https://github.com/sindresorhus')).toEqual({
      classifier: 'user',
      handle: 'sindresorhus',
    });
  });

  it('honors classifier hint when supplied', () => {
    expect(parseGithubUrl('https://github.com/anthropics', 'org')).toEqual({
      classifier: 'org',
      handle: 'anthropics',
    });
  });

  it('strips path beyond the handle (e.g. /repo)', () => {
    expect(parseGithubUrl('https://github.com/anthropics/claude-code')).toEqual({
      classifier: 'user',
      handle: 'anthropics',
    });
  });
});

describe('parseTwitterUrl', () => {
  it('parses x.com URLs', () => {
    expect(parseTwitterUrl('https://x.com/elonmusk')).toEqual({ handle: 'elonmusk' });
  });

  it('parses twitter.com URLs', () => {
    expect(parseTwitterUrl('https://twitter.com/jack')).toEqual({ handle: 'jack' });
  });

  it('strips leading @', () => {
    expect(parseTwitterUrl('https://x.com/@dril')).toEqual({ handle: 'dril' });
  });
});

describe('parseTelegramUrl', () => {
  it('extracts handle from t.me', () => {
    expect(parseTelegramUrl('https://t.me/durov')).toEqual({ handle: 'durov' });
  });
});

describe('canonicalUrl', () => {
  it('lowercases host, strips protocol, www, and trailing slash', () => {
    expect(canonicalUrl('https://www.Example.COM/Path/')).toBe('example.com/Path');
  });

  it('drops fragment, keeps query', () => {
    expect(canonicalUrl('https://example.com/p#section')).toBe('example.com/p');
  });

  it('handles bare hosts', () => {
    expect(canonicalUrl('https://example.com')).toBe('example.com');
  });
});
