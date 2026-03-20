import { describe, expect, test } from 'bun:test';
import { sanitize } from '../sanitize';

describe('sanitize', () => {
  test('strips PlanetScale token IDs', () => {
    const data = { tokenId: 'pscale_tkid_real_abc123def456' };
    const result = sanitize(data);
    expect(result.tokenId).toBe('pscale_tkid_SANITIZED_abc123');
  });

  test('strips PlanetScale tokens', () => {
    const data = { token: 'pscale_tk_real_secret_value_789' };
    const result = sanitize(data);
    expect(result.token).toBe('pscale_tk_SANITIZED_xyz789');
  });

  test('strips postgresql connection strings', () => {
    const data = {
      connection_strings: {
        general: 'postgresql://realuser:realpass123@aws.connect.psdb.cloud/postgres',
      },
    };
    const result = sanitize(data);
    expect(result.connection_strings.general).toBe(
      'postgresql://sanitized_user:SANITIZED_PASSWORD@aws.connect.psdb.cloud/postgres',
    );
  });

  test('strips plain_text passwords', () => {
    const data = { plain_text: 'super_secret_password_123' };
    const result = sanitize(data);
    expect(result.plain_text).toBe('SANITIZED_PASSWORD_xyz789');
  });

  test('strips usernames in API responses', () => {
    const data = { username: 'real_db_user_abc' };
    const result = sanitize(data);
    expect(result.username).toBe('sanitized_user_abc123');
  });

  test('strips Railway tokens', () => {
    const data = { token: 'railway_abcdefghijklmnopqrstuvwxyz' };
    const result = sanitize(data);
    expect(result.token).toBe('railway_SANITIZED_token_abc123');
  });

  test('strips JWT tokens', () => {
    const data = { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456' };
    const result = sanitize(data);
    expect(result.token).toBe('SANITIZED_JWT_TOKEN');
  });

  test('strips email addresses', () => {
    const data = { email: 'developer@company.com' };
    const result = sanitize(data);
    expect(result.email).toBe('sanitized@example.com');
  });

  test('applies custom rules', () => {
    const data = { custom: 'KEEP-THIS-abc123' };
    const result = sanitize(data, [
      { pattern: /KEEP-THIS-[a-z0-9]+/g, replacement: 'REDACTED' },
    ]);
    expect(result.custom).toBe('REDACTED');
  });

  test('handles nested objects', () => {
    const data = {
      outer: {
        inner: {
          password: 'nested_secret',
          connection: 'postgresql://user:pass@host.com/db',
        },
      },
    };
    const result = sanitize(data);
    expect(result.outer.inner.connection).toContain('sanitized_user');
    expect(result.outer.inner.connection).toContain('SANITIZED_PASSWORD');
  });

  test('handles arrays', () => {
    const data = [
      { username: 'user1', plain_text: 'pass1' },
      { username: 'user2', plain_text: 'pass2' },
    ];
    const result = sanitize(data);
    expect(result[0].username).toBe('sanitized_user_abc123');
    expect(result[1].username).toBe('sanitized_user_abc123');
    expect(result[0].plain_text).toBe('SANITIZED_PASSWORD_xyz789');
  });
});
