import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { resolveContent } from '#/modules/inquiry/services/resolveContent';

const schema = z.object({
  explanation: z.string().optional(),
  terms: z.object({ level: z.enum(['low', 'high']).default('low'), note: z.string() }).optional(),
});

describe('resolveContent', () => {
  it('merges the overrides the resolution names, parsed, so their schema defaults are filled', () => {
    expect(
      resolveContent(
        { terms: { level: 'high', note: 'asked' }, other: 1 },
        { terms: { note: 'narrowed' } },
        schema,
      ),
    ).toEqual({ terms: { level: 'low', note: 'narrowed' }, other: 1 });
  });

  it('keeps metadata and keys the resolution did not name out of the content', () => {
    expect(
      resolveContent({ terms: { level: 'high', note: 'x' } }, { explanation: 'because' }, schema),
    ).toEqual({
      terms: { level: 'high', note: 'x' },
    });
  });

  it('refuses an override its schema rejects', () => {
    expect(() => resolveContent({}, { terms: { level: 'medium', note: 'x' } }, schema)).toThrow();
  });
});
