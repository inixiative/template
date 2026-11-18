import { describe, expect, it } from 'bun:test';
import {
  decodePercentEncodedBatchReferences,
  escapeBatchInterpolation,
  tokenizeBatchInterpolation,
} from '@template/shared/batchInterpolation';

const literalText = (value: string) =>
  tokenizeBatchInterpolation(value)
    .map((token) => (token.kind === 'text' ? token.value : token.raw))
    .join('');

describe('tokenizeBatchInterpolation', () => {
  it('splits text and references', () => {
    expect(tokenizeBatchInterpolation('id <<0.1.body.data.id>> end')).toEqual([
      { kind: 'text', value: 'id ' },
      {
        kind: 'reference',
        raw: '<<0.1.body.data.id>>',
        round: 0,
        request: 1,
        fieldPath: 'body.data.id',
      },
      { kind: 'text', value: ' end' },
    ]);
  });

  it('reads an escaped bracket as literal text', () => {
    expect(tokenizeBatchInterpolation('a \\<< b \\>> c')).toEqual([
      { kind: 'text', value: 'a << b >> c' },
    ]);
  });

  it('pairs backslashes before a bracket, so an even run leaves the bracket live', () => {
    expect(tokenizeBatchInterpolation('x \\\\<<0.0.id>>')).toEqual([
      { kind: 'text', value: 'x \\' },
      { kind: 'reference', raw: '<<0.0.id>>', round: 0, request: 0, fieldPath: 'id' },
    ]);
    expect(literalText('x \\\\\\<<y')).toBe('x \\<<y');
  });

  it('leaves backslashes that are not before a bracket untouched', () => {
    expect(literalText('C:\\\\path\\to \\n')).toBe('C:\\\\path\\to \\n');
  });

  it('reads extra leading < before a reference as text', () => {
    expect(tokenizeBatchInterpolation('<<<0.0.id>>')).toEqual([
      { kind: 'text', value: '<' },
      { kind: 'reference', raw: '<<0.0.id>>', round: 0, request: 0, fieldPath: 'id' },
    ]);
  });

  it('refuses bracketed text that is not a reference, even with a single > inside', () => {
    expect(() => tokenizeBatchInterpolation('<<0.0.a>b>>')).toThrow(
      'Malformed interpolation syntax',
    );
  });

  it('still refuses stray, nested and malformed brackets', () => {
    expect(() => tokenizeBatchInterpolation('a << b')).toThrow('unclosed <<');
    expect(() => tokenizeBatchInterpolation('a >> b')).toThrow('closing >> without opening <<');
    expect(() => tokenizeBatchInterpolation('<<0.0.<<1.0.id>>>>')).toThrow('Nested interpolation');
    expect(() => tokenizeBatchInterpolation('<<invalid>>')).toThrow(
      'Malformed interpolation syntax',
    );
  });
});

describe('escapeBatchInterpolation', () => {
  const samples = [
    '',
    'plain',
    'a << b',
    'a >> b',
    '<<0.0.body.data.id>>',
    '\\<<',
    '\\\\>>',
    '<<<>>>',
    'C:\\\\dir\\\\<<file>>',
    'x \\ y << z >> \\\\',
  ];

  it('round-trips any text to itself through the tokenizer', () => {
    for (const sample of samples) {
      expect(literalText(escapeBatchInterpolation(sample))).toBe(sample);
      expect(
        tokenizeBatchInterpolation(escapeBatchInterpolation(sample)).every(
          (token) => token.kind === 'text',
        ),
      ).toBe(true);
    }
  });

  it("round-trips random text built from the grammar's characters", () => {
    let seed = 20261118;
    const nextRandom = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const alphabet = ['<', '>', '\\', 'a', '.', '0'];
    for (let sample = 0; sample < 5000; sample++) {
      const length = Math.floor(nextRandom() * 12);
      let text = '';
      for (let index = 0; index < length; index++) {
        text += alphabet[Math.floor(nextRandom() * alphabet.length)];
      }
      expect(literalText(escapeBatchInterpolation(text))).toBe(text);
    }
  });

  it('leaves text without brackets unchanged', () => {
    expect(escapeBatchInterpolation('C:\\\\path and text')).toBe('C:\\\\path and text');
  });
});

describe('decodePercentEncodedBatchReferences', () => {
  it('decodes only the encoded reference shape, in either hex case', () => {
    expect(
      decodePercentEncodedBatchReferences(
        '/api/v1/organization/%3C%3C0.0.body.data.id%3E%3E/users',
      ),
    ).toBe('/api/v1/organization/<<0.0.body.data.id>>/users');
    expect(decodePercentEncodedBatchReferences('/a/%3c%3c1.2.id%3e%3e')).toBe('/a/<<1.2.id>>');
  });

  it('carries encoded escapes, so an escaped reference sent through a URL stays literal', () => {
    const literal = '<<0.0.id>>';
    const decoded = decodePercentEncodedBatchReferences(
      `/search?q=${encodeURIComponent(escapeBatchInterpolation(literal))}`,
    );
    expect(decoded).toBe('/search?q=\\<<0.0.id\\>>');
    expect(literalText(decoded)).toBe(`/search?q=${literal}`);
  });

  it('leaves every other encoding alone', () => {
    const path = '/api/v1/search?q=a%2Fb%20c%3C%3Cnot-a-reference%3E%3E';
    expect(decodePercentEncodedBatchReferences(path)).toBe(path);
  });
});
