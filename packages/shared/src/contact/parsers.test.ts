import { describe, expect, it } from 'bun:test';
import {
  canonicalUrl,
  parseBlueskyUrl,
  parseFacebookUrl,
  parseGithubUrl,
  parseInstagramUrl,
  parseLinkedinUrl,
  parseMastodonUrl,
  parseRedditUrl,
  parseSimpleHandleUrl,
  parseTelegramUrl,
  parseThreadsUrl,
  parseTiktokUrl,
  parseTwitterUrl,
  parseYoutubeUrl,
} from '@template/shared/contact/parsers';

describe('parseSimpleHandleUrl', () => {
  it('lowercases handle by default', () => {
    expect(parseSimpleHandleUrl('example.com', 'https://example.com/JohnDoe')).toBe('johndoe');
  });

  it('preserves case when caseInsensitive=false', () => {
    expect(parseSimpleHandleUrl('example.com', 'https://example.com/JohnDoe', { caseInsensitive: false })).toBe(
      'JohnDoe',
    );
  });

  it('strips leading @', () => {
    expect(parseSimpleHandleUrl('example.com', 'https://example.com/@JohnDoe')).toBe('johndoe');
  });

  it('rejects mismatched host', () => {
    expect(() => parseSimpleHandleUrl('example.com', 'https://other.com/johndoe')).toThrow();
  });

  it('rejects unknown prefix when prefix supplied', () => {
    expect(() => parseSimpleHandleUrl('example.com', 'https://example.com/wrong/x', { prefix: 'profile' })).toThrow();
  });
});

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

  it('strips leading @ and lowercases together', () => {
    expect(parseTwitterUrl('https://x.com/@Dril')).toEqual({ handle: 'dril' });
  });
});

describe('parseTelegramUrl', () => {
  it('extracts handle from t.me', () => {
    expect(parseTelegramUrl('https://t.me/durov')).toEqual({ handle: 'durov' });
  });
});

describe('parseBlueskyUrl', () => {
  it('extracts handle behind /profile/', () => {
    expect(parseBlueskyUrl('https://bsky.app/profile/aron.bsky.social')).toEqual({
      handle: 'aron.bsky.social',
    });
  });

  it('rejects URLs without /profile/ prefix', () => {
    expect(() => parseBlueskyUrl('https://bsky.app/aron.bsky.social')).toThrow();
  });
});

describe('parseFacebookUrl', () => {
  it('extracts handle', () => {
    expect(parseFacebookUrl('https://facebook.com/zuck')).toEqual({ handle: 'zuck' });
  });
});

describe('parseInstagramUrl', () => {
  it('extracts handle', () => {
    expect(parseInstagramUrl('https://instagram.com/cristiano')).toEqual({ handle: 'cristiano' });
  });
});

describe('parseThreadsUrl', () => {
  it('extracts handle and strips @', () => {
    expect(parseThreadsUrl('https://threads.net/@zuck')).toEqual({ handle: 'zuck' });
  });
});

describe('parseTiktokUrl', () => {
  it('extracts handle and strips @', () => {
    expect(parseTiktokUrl('https://tiktok.com/@charlidamelio')).toEqual({ handle: 'charlidamelio' });
  });
});

describe('parseMastodonUrl', () => {
  it('extracts instance and handle', () => {
    expect(parseMastodonUrl('https://mastodon.social/@Gargron')).toEqual({
      instance: 'mastodon.social',
      handle: 'gargron',
    });
  });

  it('works for arbitrary instance hosts', () => {
    expect(parseMastodonUrl('https://hachyderm.io/@aron')).toEqual({
      instance: 'hachyderm.io',
      handle: 'aron',
    });
  });

  it('rejects when handle segment lacks @', () => {
    expect(() => parseMastodonUrl('https://mastodon.social/gargron')).toThrow();
  });
});

describe('parseRedditUrl', () => {
  it('accepts /u/ prefix', () => {
    expect(parseRedditUrl('https://reddit.com/u/spez')).toEqual({ handle: 'spez' });
  });

  it('accepts /user/ prefix', () => {
    expect(parseRedditUrl('https://reddit.com/user/spez')).toEqual({ handle: 'spez' });
  });

  it('rejects URLs without a recognized prefix', () => {
    expect(() => parseRedditUrl('https://reddit.com/spez')).toThrow();
  });
});

describe('parseYoutubeUrl', () => {
  it('parses @handle URLs', () => {
    expect(parseYoutubeUrl('https://youtube.com/@MrBeast')).toEqual({ handle: 'mrbeast' });
  });

  it('parses /c/<handle> URLs', () => {
    expect(parseYoutubeUrl('https://youtube.com/c/MrBeast')).toEqual({ handle: 'mrbeast' });
  });

  it('parses /user/<handle> URLs', () => {
    expect(parseYoutubeUrl('https://youtube.com/user/MrBeast')).toEqual({ handle: 'mrbeast' });
  });

  it('parses bare /<handle> URLs as a fallback', () => {
    expect(parseYoutubeUrl('https://youtube.com/MrBeast')).toEqual({ handle: 'mrbeast' });
  });

  // Channel IDs (UCxxx) aren't human handles — surface as an error so callers
  // can prompt for the canonical @handle URL.
  it('rejects /channel/<id> URLs', () => {
    expect(() => parseYoutubeUrl('https://youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA')).toThrow();
  });

  it('rejects non-youtube hosts', () => {
    expect(() => parseYoutubeUrl('https://vimeo.com/@mrbeast')).toThrow();
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
