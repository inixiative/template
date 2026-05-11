import { describe, expect, it } from 'bun:test';
import { isDatePath, isEnumPath, isStringPath, lookupField } from '#/lib/prisma/fieldMetadata';

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

describe('isStringPath', () => {
  it('true for top-level String fields', () => {
    expect(isStringPath('User', 'email')).toBe(true);
    expect(isStringPath('User', 'name')).toBe(true);
  });

  it('true for String fields via relation', () => {
    expect(isStringPath('Inquiry', 'sourceUser.email')).toBe(true);
  });

  it('false for enum / DateTime / Boolean / Int fields', () => {
    expect(isStringPath('User', 'platformRole')).toBe(false);
    expect(isStringPath('User', 'emailVerified')).toBe(false);
    expect(isStringPath('User', 'createdAt')).toBe(false);
  });

  it('false for unknown paths', () => {
    expect(isStringPath('User', 'notAField')).toBe(false);
  });
});

describe('isEnumPath', () => {
  it('true for enum fields', () => {
    expect(isEnumPath('User', 'platformRole')).toBe(true);
    expect(isEnumPath('Inquiry', 'type')).toBe(true);
  });

  it('false for scalar fields', () => {
    expect(isEnumPath('User', 'email')).toBe(false);
  });

  it('walks relations', () => {
    expect(isEnumPath('Inquiry', 'sourceUser.platformRole')).toBe(true);
    expect(isEnumPath('Inquiry', 'sourceUser.email')).toBe(false);
  });
});

describe('isDatePath', () => {
  it('true for DateTime fields', () => {
    expect(isDatePath('User', 'createdAt')).toBe(true);
    expect(isDatePath('User', 'updatedAt')).toBe(true);
  });

  it('false for String fields', () => {
    expect(isDatePath('User', 'email')).toBe(false);
  });

  it('walks relations', () => {
    expect(isDatePath('Inquiry', 'sourceUser.createdAt')).toBe(true);
  });
});
