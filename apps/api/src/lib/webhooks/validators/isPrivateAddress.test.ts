import { describe, expect, it } from 'bun:test';
import { isPrivateAddress } from '#/lib/webhooks/validators/isPrivateAddress';

describe('isPrivateAddress', () => {
  it('classifies IPv4 ranges', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('203.0.113.10')).toBe(false);
    expect(isPrivateAddress('224.0.0.1')).toBe(true);
    expect(isPrivateAddress('255.255.255.255')).toBe(true);
    expect(isPrivateAddress('198.18.0.1')).toBe(true);
    expect(isPrivateAddress('192.0.0.1')).toBe(true);
  });

  it('classifies IPv6 ranges', () => {
    expect(isPrivateAddress('2606:2800:220:1::1')).toBe(false);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fd12:3456::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('ff02::1')).toBe(true);
    expect(isPrivateAddress('::ffff:192.168.0.1')).toBe(true);
  });

  it('returns false for non-IP strings', () => {
    expect(isPrivateAddress('example.com')).toBe(false);
  });
});
