import { describe, expect, it } from 'bun:test';
import type { Context } from 'hono';

import { clientIp } from '#/lib/clientIp';

const ctx = (headers: Record<string, string>): Context =>
  ({ req: { header: (name: string) => headers[name.toLowerCase()] } }) as unknown as Context;

describe('clientIp', () => {
  it('takes the trusted rightmost forwarded hop, not the spoofable leftmost', () => {
    expect(clientIp(ctx({ 'x-forwarded-for': 'evil-spoof, 203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip when there is no forwarded header', () => {
    expect(clientIp(ctx({ 'x-real-ip': '198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('buckets IPv6 to its /64 so a client cannot rotate addresses for free', () => {
    expect(clientIp(ctx({ 'x-forwarded-for': '2001:db8:1234:5678:9abc:def0:1:2' }))).toBe('2001:db8:1234:5678');
  });

  it('strips an IPv6 zone id before bucketing', () => {
    expect(clientIp(ctx({ 'x-real-ip': 'fe80:0:0:0:1:2:3:4%eth0' }))).toBe('fe80:0:0:0');
  });

  it('buckets an IPv4-mapped IPv6 on its embedded IPv4, not a shared 0:0:0:0', () => {
    expect(clientIp(ctx({ 'x-forwarded-for': '::ffff:203.0.113.7' }))).toBe('203.0.113.7');
    expect(clientIp(ctx({ 'x-forwarded-for': '::ffff:198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('returns "unknown" when no address is present', () => {
    expect(clientIp(ctx({}))).toBe('unknown');
  });
});
