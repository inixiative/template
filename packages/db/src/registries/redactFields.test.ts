import { describe, expect, it } from 'bun:test';
import { getRedactFields, HOOK_REDACT_FIELDS, redactSensitiveFields } from '@template/db/registries';

describe('redactFields', () => {
  describe('HOOK_REDACT_FIELDS', () => {
    it('defines sensitive fields for Account', () => {
      expect(HOOK_REDACT_FIELDS.Account).toContain('password');
    });

    it('defines sensitive fields for Token', () => {
      expect(HOOK_REDACT_FIELDS.Token).toContain('keyHash');
    });

    it('auto-injects encrypted columns for AuthProvider from encryption registry', () => {
      expect(HOOK_REDACT_FIELDS.AuthProvider).toContain('encryptedSecrets');
      expect(HOOK_REDACT_FIELDS.AuthProvider).toContain('encryptedSecretsMetadata');
      expect(HOOK_REDACT_FIELDS.AuthProvider).toContain('encryptedSecretsKeyVersion');
    });
  });

  describe('getRedactFields', () => {
    it('returns empty array for unknown model', () => {
      expect(getRedactFields('UnknownModel')).toEqual([]);
    });

    it('returns sensitive fields for Account', () => {
      expect(getRedactFields('Account')).toContain('password');
    });

    it('returns sensitive fields for Token', () => {
      expect(getRedactFields('Token')).toContain('keyHash');
    });
  });

  describe('redactSensitiveFields', () => {
    it('replaces sensitive Account fields with [REDACTED]', () => {
      const data = { id: '1', accountId: 'acc-1', password: 'super-secret', providerId: 'google' };
      const result = redactSensitiveFields('Account', data);
      expect(result.password).toBe('[REDACTED]');
      expect(result.id).toBe('1');
      expect(result.providerId).toBe('google');
    });

    it('replaces Token keyHash with [REDACTED]', () => {
      const data = { id: '1', name: 'my-token', keyHash: 'hash123', keyPrefix: 'tok_' };
      const result = redactSensitiveFields('Token', data);
      expect(result.keyHash).toBe('[REDACTED]');
      expect(result.name).toBe('my-token');
      expect(result.keyPrefix).toBe('tok_');
    });

    it('redacts AuthProvider encrypted columns via auto-inject', () => {
      const data: Record<string, unknown> = {
        id: '1',
        encryptedSecrets: 'cipher',
        encryptedSecretsMetadata: { iv: 'a', authTag: 'b' },
        encryptedSecretsKeyVersion: 1,
      };
      const result = redactSensitiveFields('AuthProvider', data);
      expect(result.encryptedSecrets).toBe('[REDACTED]');
      expect(result.encryptedSecretsMetadata).toBe('[REDACTED]');
      expect(result.encryptedSecretsKeyVersion).toBe('[REDACTED]');
    });

    it('uses custom redact value when provided', () => {
      const data = { id: '1', password: 'secret' };
      const result = redactSensitiveFields('Account', data, '***');
      expect(result.password).toBe('***');
    });

    it('does not modify data for models with no sensitive fields', () => {
      const data = { id: '1', name: 'test-org', slug: 'test' };
      const result = redactSensitiveFields('Organization', data);
      expect(result).toEqual(data);
    });

    it('does not modify fields not in the redact list', () => {
      const data = { id: '1', password: 'secret', email: 'user@example.com' };
      const result = redactSensitiveFields('Account', data);
      expect(result.email).toBe('user@example.com');
      expect(result.id).toBe('1');
    });

    it('handles data without sensitive fields gracefully', () => {
      const data = { id: '1', accountId: 'acc-1', providerId: 'google' };
      const result = redactSensitiveFields('Account', data);
      expect(result).toEqual(data);
    });
  });
});
