import { describe, expect, it } from 'bun:test';
import {
  getRedactFields,
  REDACT_FIELDS,
  redactChangeDiff,
  redactPayload,
  redactSensitiveFields,
  SENSITIVE_KEYS,
  WEBHOOK_DROP_FIELDS,
} from '@template/db/registries';

describe('REDACT_FIELDS', () => {
  it('includes plaintext-sensitive columns', () => {
    expect(REDACT_FIELDS.Account).toContain('password');
    expect(REDACT_FIELDS.Token).toContain('keyHash');
  });

  it('folds in encrypted columns from the encryption registry', () => {
    expect(REDACT_FIELDS.AuthProvider).toContain('encryptedSecrets');
    expect(REDACT_FIELDS.AuthProvider).toContain('encryptedSecretsMetadata');
    expect(REDACT_FIELDS.AuthProvider).toContain('encryptedSecretsKeyVersion');
  });
});

describe('WEBHOOK_DROP_FIELDS (NOOP ∪ REDACT)', () => {
  it('drops both noop noise and sensitive columns', () => {
    expect(WEBHOOK_DROP_FIELDS._global).toContain('updatedAt');
    expect(WEBHOOK_DROP_FIELDS.Token).toEqual(expect.arrayContaining(['lastUsedAt', 'keyHash']));
  });
});

describe('SENSITIVE_KEYS', () => {
  it('is the flat set of every redacted field name across models', () => {
    expect(SENSITIVE_KEYS.has('password')).toBe(true);
    expect(SENSITIVE_KEYS.has('keyHash')).toBe(true);
    expect(SENSITIVE_KEYS.has('encryptedSecrets')).toBe(true);
  });
});

describe('getRedactFields', () => {
  it('returns [] for a model with no sensitive fields', () => {
    expect(getRedactFields('UnknownModel')).toEqual([]);
  });
});

describe('redactSensitiveFields', () => {
  it('masks Account password, keeps the rest', () => {
    const result = redactSensitiveFields('Account', { id: '1', password: 'secret', providerId: 'google' });
    expect(result.password).toBe('[REDACTED]');
    expect(result.providerId).toBe('google');
  });

  it('masks AuthProvider encrypted columns', () => {
    const result = redactSensitiveFields('AuthProvider', { id: '1', encryptedSecrets: 'cipher' });
    expect(result.encryptedSecrets).toBe('[REDACTED]');
  });

  it('leaves a non-sensitive model untouched', () => {
    const data = { id: '1', slug: 'x' };
    expect(redactSensitiveFields('Organization', data)).toEqual(data);
  });
});

describe('redactChangeDiff', () => {
  it('masks both sides of a sensitive change but keeps the key (records THAT it changed)', () => {
    const changes = { keyHash: { before: 'a', after: 'b' }, name: { before: 'x', after: 'y' } };
    const result = redactChangeDiff('Token', changes);
    expect(result.keyHash).toEqual({ before: '[REDACTED]', after: '[REDACTED]' });
    expect(result.name).toEqual({ before: 'x', after: 'y' });
  });
});

describe('redactPayload', () => {
  it('recursively masks sensitive keys anywhere in a payload', () => {
    const payload = { userId: '1', account: { password: 'secret', email: 'a@b.c' }, items: [{ keyHash: 'h' }] };
    const result = redactPayload(payload);
    expect(result.account.password).toBe('[REDACTED]');
    expect(result.account.email).toBe('a@b.c');
    expect(result.items[0].keyHash).toBe('[REDACTED]');
    expect(result.userId).toBe('1');
  });
});
