import { describe, expect, it } from 'bun:test';
import { getRedactFields, HOOK_REDACT_FIELDS, redactSensitiveFields } from '@template/db/registries';

describe('redactFields', () => {
  describe('HOOK_REDACT_FIELDS', () => {
    it('defines sensitive fields for Account', () => {
      expect(HOOK_REDACT_FIELDS.Account).toContain('password');
    });

    it('defines sensitive fields for Token', () => {
      expect(HOOK_REDACT_FIELDS.Token).toContain('value');
      expect(HOOK_REDACT_FIELDS.Token).toContain('hashedValue');
    });

    it('defines sensitive fields for AuthProvider', () => {
      expect(HOOK_REDACT_FIELDS.AuthProvider).toContain('secrets');
    });
  });

  describe('getRedactFields', () => {
    it('returns empty array for unknown model', () => {
      expect(getRedactFields('UnknownModel')).toEqual([]);
    });

    it('returns sensitive fields for Account', () => {
      const fields = getRedactFields('Account');
      expect(fields).toContain('password');
    });

    it('returns sensitive fields for Token', () => {
      const fields = getRedactFields('Token');
      expect(fields).toContain('value');
      expect(fields).toContain('hashedValue');
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

    it('replaces sensitive Token fields with [REDACTED]', () => {
      const data = { id: '1', name: 'my-token', value: 'tok_secret', hashedValue: 'hash123', keyPrefix: 'tok_' };
      const result = redactSensitiveFields('Token', data);
      expect(result.value).toBe('[REDACTED]');
      expect(result.hashedValue).toBe('[REDACTED]');
      expect(result.name).toBe('my-token');
      expect(result.keyPrefix).toBe('tok_');
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
