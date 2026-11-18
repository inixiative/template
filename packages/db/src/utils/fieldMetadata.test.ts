import { describe, expect, it } from 'bun:test';
import { modelFieldAtPath } from '@template/db/utils/fieldMetadata';

describe('modelFieldAtPath', () => {
  it('resolves a top-level scalar field', () => {
    const field = modelFieldAtPath('User', 'email');
    expect(field?.kind).toBe('scalar');
    expect(field?.type).toBe('String');
  });

  it('resolves a top-level enum field', () => {
    const field = modelFieldAtPath('User', 'platformRole');
    expect(field?.kind).toBe('enum');
  });

  it('walks relations for nested paths', () => {
    const field = modelFieldAtPath('Inquiry', 'sourceUser.email');
    expect(field?.kind).toBe('scalar');
    expect(field?.type).toBe('String');
  });

  it('returns undefined for unknown model', () => {
    expect(modelFieldAtPath('NotAModel', 'email')).toBeUndefined();
  });

  it('returns undefined for unknown field', () => {
    expect(modelFieldAtPath('User', 'notAField')).toBeUndefined();
  });

  it('returns undefined when a non-relation segment appears mid-path', () => {
    expect(modelFieldAtPath('User', 'email.foo')).toBeUndefined();
  });
});
