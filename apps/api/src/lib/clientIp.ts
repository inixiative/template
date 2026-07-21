/**
 * @atlas
 * @kind utils
 * @partOf primitive:requestContext
 * @uses none
 */
import type { Context } from 'hono';

// The edge proxy appends the peer address on the RIGHT of x-forwarded-for; bump only if another trusted proxy is chained in front.
const TRUSTED_PROXY_HOPS = 1;

// A client owns its whole IPv6 /64, so keying on the /128 lets it rotate identities for free.
const toBucketAddress = (ip: string): string => {
  if (!ip.includes(':')) return ip;
  const mappedIpv4 = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)?.[1];
  if (mappedIpv4) return mappedIpv4;
  const head = ip.split('%')[0] ?? ip;

  let hextets: string[];
  if (head.includes('::')) {
    const [left, right = ''] = head.split('::');
    const leftParts = left ? left.split(':') : [];
    const rightParts = right ? right.split(':') : [];
    const zeros = Array(Math.max(0, 8 - leftParts.length - rightParts.length)).fill('0');
    hextets = [...leftParts, ...zeros, ...rightParts];
  } else {
    hextets = head.split(':');
  }

  return hextets
    .slice(0, 4)
    .map((hextet) => hextet || '0')
    .join(':');
};

// x-forwarded-for[0] is client-supplied: trusting it lets any caller mint a fresh identity per request and bypass IP-keyed limits.
export const clientIp = (c: Context): string => {
  const forwarded = c.req.header('x-forwarded-for');
  const hops = forwarded
    ?.split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);

  const trusted = hops?.length ? hops[Math.max(0, hops.length - TRUSTED_PROXY_HOPS)] : undefined;
  const ip = trusted ?? c.req.header('x-real-ip')?.trim();

  return ip ? toBucketAddress(ip) : 'unknown';
};
