import { describe, expect, it } from 'bun:test';
import { featureFlagSlugSchema, isCustomFlagSlug, keepSlugCharacters, slugSchema, toSlug } from './slug';

describe('slug', () => {
  it('accepts lowercase words joined by single hyphens and nothing else', () => {
    for (const ok of ['acme', 'acme-corp', 'a1-b2']) expect(slugSchema.safeParse(ok).success).toBe(true);
    for (const bad of ['', 'Acme', 'acme--corp', '-acme', 'acme-', 'acme corp', 'custom:x']) {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('derives a slug from a name and keeps only slug characters while typing', () => {
    expect(toSlug('  Acme  Corp! ')).toBe('acme-corp');
    expect(keepSlugCharacters('Ac-me C')).toBe('ac-mec');
  });

  it('a feature flag slug is a slug, optionally behind custom:', () => {
    expect(featureFlagSlugSchema.safeParse('dark-mode').success).toBe(true);
    expect(featureFlagSlugSchema.safeParse('custom:dark-mode').success).toBe(true);
    expect(featureFlagSlugSchema.safeParse('custom:').success).toBe(false);
    expect(featureFlagSlugSchema.safeParse('rollout:dark-mode').success).toBe(false);
    expect(isCustomFlagSlug('custom:x')).toBe(true);
    expect(isCustomFlagSlug('x')).toBe(false);
  });
});
