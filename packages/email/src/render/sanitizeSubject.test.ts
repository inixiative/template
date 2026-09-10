import { describe, expect, it } from 'bun:test';
import { sanitizeSubject } from '@template/email/render/sanitizeSubject';

describe('sanitizeSubject', () => {
  it('replaces CRLF sequences so injected header lines collapse into the subject', () => {
    expect(sanitizeSubject('Hello\r\nBcc: evil@example.com')).toBe('Hello Bcc: evil@example.com');
  });

  it('replaces bare control characters with a single space', () => {
    expect(sanitizeSubject('A\tB C D')).toBe('A B C D');
  });

  it('decodes the entities interpolation escapes, since a subject is not HTML', () => {
    expect(sanitizeSubject('Tom &amp; Jerry&#39;s &lt;weekly&gt; &quot;digest&quot;')).toBe(
      'Tom & Jerry\'s <weekly> "digest"',
    );
  });

  it('collapses whitespace runs and trims', () => {
    expect(sanitizeSubject('  Your   order\n\n\nshipped  ')).toBe('Your order shipped');
  });

  it('returns a plain subject unchanged', () => {
    expect(sanitizeSubject('Welcome to Acme')).toBe('Welcome to Acme');
  });
});
