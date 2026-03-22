import { describe, expect, test } from 'bun:test';
import { sanitize } from '../sanitize';

describe('sanitize', () => {
  test('strips Anthropic API keys', () => {
    const data = { key: 'sk-ant-abc123def456xyz789' };
    const result = sanitize(data);
    expect(result.key).toBe('sk-ant-SANITIZED_key_abc123');
  });

  test('strips OpenAI API keys', () => {
    const data = { key: 'sk-abcdefghijklmnopqrstuvwxyz1234567890' };
    const result = sanitize(data);
    expect(result.key).toBe('sk-SANITIZED_key_abc123xyz789');
  });

  test('strips Anthropic message IDs', () => {
    const data = { id: 'msg_01XAbc123DefGhiJkl' };
    const result = sanitize(data);
    expect(result.id).toBe('msg_SANITIZED_000');
  });

  test('strips OpenAI completion IDs', () => {
    const data = { id: 'chatcmpl-abc123def456' };
    const result = sanitize(data);
    expect(result.id).toBe('chatcmpl-SANITIZED_000');
  });

  test('strips system fingerprints', () => {
    const data = { system_fingerprint: 'fp_abc123def456' };
    const result = sanitize(data);
    expect(result.system_fingerprint).toBe('fp_SANITIZED');
  });

  test('strips organization IDs', () => {
    const data = { organization: 'org-abc123' };
    const result = sanitize(data);
    expect(result.organization).toBe('org-SANITIZED');
  });

  test('strips postgresql connection strings', () => {
    const data = {
      url: 'postgresql://realuser:realpass@host.com/mydb',
    };
    const result = sanitize(data);
    expect(result.url).toBe('postgresql://sanitized_user:SANITIZED_PASSWORD@host.com/mydb');
  });

  test('strips redis connection strings', () => {
    const data = { url: 'redis://user:password@redis.host.com' };
    const result = sanitize(data);
    expect(result.url).toBe('redis://sanitized_user:SANITIZED_PASSWORD@redis.host.com');
  });

  test('strips JWTs', () => {
    const data = { token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123def456' };
    const result = sanitize(data);
    expect(result.token).toBe('SANITIZED_JWT_TOKEN');
  });

  test('strips PlanetScale tokens', () => {
    const data = {
      tokenId: 'pscale_tkid_real_abc123def456',
      token: 'pscale_tk_real_secret_value_789',
    };
    const result = sanitize(data);
    expect(result.tokenId).toBe('pscale_tkid_SANITIZED_abc123');
    expect(result.token).toBe('pscale_tk_SANITIZED_xyz789');
  });

  test('strips email addresses', () => {
    const data = { email: 'developer@company.com' };
    const result = sanitize(data);
    expect(result.email).toBe('sanitized@example.com');
  });

  test('handles nested AI provider responses', () => {
    const data = {
      id: 'msg_01RealId',
      content: [{ type: 'text', text: 'Hello world' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    };
    const result = sanitize(data);
    expect(result.id).toBe('msg_SANITIZED_000');
    expect(result.content[0].text).toBe('Hello world'); // content preserved
    expect(result.usage.input_tokens).toBe(100); // usage preserved
  });

  test('applies custom rules alongside defaults', () => {
    const data = { custom: 'INTERNAL-CODE-abc123', id: 'msg_realId' };
    const result = sanitize(data, [{ pattern: /INTERNAL-CODE-[a-z0-9]+/g, replacement: 'REDACTED' }]);
    expect(result.custom).toBe('REDACTED');
    expect(result.id).toBe('msg_SANITIZED_000'); // default rule still applies
  });
});
