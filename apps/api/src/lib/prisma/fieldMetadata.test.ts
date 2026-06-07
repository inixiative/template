import { describe, expect, it } from 'bun:test';
import { lookupField } from '#/lib/prisma/fieldMetadata';

describe('lookupField', () => {
  it('resolves a top-level scalar field', () => {
    const field = lookupField('User', 'email');
    expect(field?.kind).toBe('scalar');
    expect(field?.type).toBe('String');
  });

  it('resolves a top-level enum field', () => {
    const field = lookupField('User', 'platformRole');
    expect(field?.kind).toBe('enum');
  });

  it('walks relations for nested paths', () => {
    const field = lookupField('Inquiry', 'sourceUser.email');
    expect(field?.kind).toBe('scalar');
    expect(field?.type).toBe('String');
  });

  it('returns undefined for unknown model', () => {
    expect(lookupField('NotAModel', 'email')).toBeUndefined();
  });

  it('returns undefined for unknown field', () => {
    expect(lookupField('User', 'notAField')).toBeUndefined();
  });

  it('returns undefined when a non-relation segment appears mid-path', () => {
    expect(lookupField('User', 'email.foo')).toBeUndefined();
  });
});
