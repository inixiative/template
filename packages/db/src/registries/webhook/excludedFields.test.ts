import { describe, expect, it } from 'bun:test';
import { WEBHOOK_EXCLUDED_FIELDS } from '@template/db/registries';

describe('WEBHOOK_EXCLUDED_FIELDS', () => {
  it('excludes no-op fields', () => {
    expect(WEBHOOK_EXCLUDED_FIELDS._global).toContain('updatedAt');
    expect(WEBHOOK_EXCLUDED_FIELDS.Token).toContain('lastUsedAt');
  });

  it('excludes sensitive fields', () => {
    expect(WEBHOOK_EXCLUDED_FIELDS.Token).toContain('keyHash');
    expect(WEBHOOK_EXCLUDED_FIELDS.Account).toContain('password');
  });

  it('excludes internal fields', () => {
    expect(WEBHOOK_EXCLUDED_FIELDS.User).toContain('platformRole');
  });

  it('keeps every arm of a model that sits in more than one', () => {
    expect(WEBHOOK_EXCLUDED_FIELDS.User).toEqual(
      expect.arrayContaining(['lastLoginAt', 'platformRole']),
    );
  });
});
