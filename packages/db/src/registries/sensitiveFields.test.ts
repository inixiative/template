import { describe, expect, it } from 'bun:test';
import {
  maskSensitiveFields,
  maskSensitiveFieldsInChangeDiff,
  maskSensitiveFieldsInPayload,
  SENSITIVE_FIELD_NAMES,
  SENSITIVE_FIELDS,
  sensitiveFieldsOf,
  WEBHOOK_EXCLUDED_FIELDS,
} from '@template/db/registries';

describe('SENSITIVE_FIELDS', () => {
  it('includes plaintext-sensitive columns', () => {
    expect(SENSITIVE_FIELDS.Account).toContain('password');
    expect(SENSITIVE_FIELDS.Token).toContain('keyHash');
  });

  it('folds in encrypted columns from the encryption registry', () => {
    expect(SENSITIVE_FIELDS.AuthProvider).toContain('encryptedSecrets');
    expect(SENSITIVE_FIELDS.AuthProvider).toContain('encryptedSecretsMetadata');
    expect(SENSITIVE_FIELDS.AuthProvider).toContain('encryptedSecretsKeyVersion');
  });
});

describe('WEBHOOK_EXCLUDED_FIELDS (NOOP ∪ REDACT)', () => {
  it('drops both noop noise and sensitive columns', () => {
    expect(WEBHOOK_EXCLUDED_FIELDS._global).toContain('updatedAt');
    expect(WEBHOOK_EXCLUDED_FIELDS.Token).toEqual(
      expect.arrayContaining(['lastUsedAt', 'keyHash']),
    );
  });
});

describe('SENSITIVE_FIELD_NAMES', () => {
  it('is the flat set of every redacted field name across models', () => {
    expect(SENSITIVE_FIELD_NAMES.has('password')).toBe(true);
    expect(SENSITIVE_FIELD_NAMES.has('keyHash')).toBe(true);
    expect(SENSITIVE_FIELD_NAMES.has('encryptedSecrets')).toBe(true);
  });
});

describe('sensitiveFieldsOf', () => {
  it('returns [] for a model with no sensitive fields', () => {
    expect(sensitiveFieldsOf('UnknownModel')).toEqual([]);
  });
});

describe('maskSensitiveFields', () => {
  it('masks Account password, keeps the rest', () => {
    const result = maskSensitiveFields('Account', {
      id: '1',
      password: 'secret',
      providerId: 'google',
    });
    expect(result.password).toBe('[REDACTED]');
    expect(result.providerId).toBe('google');
  });

  it('masks AuthProvider encrypted columns', () => {
    const result = maskSensitiveFields('AuthProvider', { id: '1', encryptedSecrets: 'cipher' });
    expect(result.encryptedSecrets).toBe('[REDACTED]');
  });

  it('leaves a non-sensitive model untouched', () => {
    const data = { id: '1', slug: 'x' };
    expect(maskSensitiveFields('Organization', data)).toEqual(data);
  });
});

describe('maskSensitiveFieldsInChangeDiff', () => {
  it('masks both sides of a sensitive change but keeps the key (records THAT it changed)', () => {
    const changes = { keyHash: { before: 'a', after: 'b' }, name: { before: 'x', after: 'y' } };
    const result = maskSensitiveFieldsInChangeDiff('Token', changes);
    expect(result.keyHash).toEqual({ before: '[REDACTED]', after: '[REDACTED]' });
    expect(result.name).toEqual({ before: 'x', after: 'y' });
  });
});

describe('maskSensitiveFieldsInPayload', () => {
  it('recursively masks sensitive keys anywhere in a payload', () => {
    const payload = {
      userId: '1',
      account: { password: 'secret', email: 'a@b.c' },
      items: [{ keyHash: 'h' }],
    };
    const result = maskSensitiveFieldsInPayload(payload);
    expect(result.account.password).toBe('[REDACTED]');
    expect(result.account.email).toBe('a@b.c');
    expect(result.items[0].keyHash).toBe('[REDACTED]');
    expect(result.userId).toBe('1');
  });
});
