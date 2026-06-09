import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isTest } from '@template/shared/utils';
import type { Env } from '#/config/env';

// SSRF guard: webhook URLs are tenant-supplied and fetched server-side, so in
// deployed environments they must be https and may not target private hosts.
// Local and test keep private addresses available for development loops.
const enforcedEnvironments: Record<Env['ENVIRONMENT'], boolean> = {
  local: false,
  test: false,
  pr: true,
  staging: true,
  prod: true,
};

const isEnforcedEnvironment = (): boolean => {
  const environment = process.env.ENVIRONMENT ?? (isTest ? 'test' : 'prod');
  return enforcedEnvironments[environment] ?? true;
};

const isPrivateIPv4 = (ip: string): boolean => {
  const [a, b, c] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0 && c === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return a >= 224;
};

const isPrivateIPv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  const v4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Mapped) return isPrivateIPv4(v4Mapped[1]);
  // URL.hostname normalizes v4-mapped addresses to hex groups (::ffff:a00:1)
  const v4MappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (v4MappedHex) {
    const high = Number.parseInt(v4MappedHex[1], 16);
    const low = Number.parseInt(v4MappedHex[2], 16);
    return isPrivateIPv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }
  return /^(f[cd]|fe[89ab]|ff)/.test(normalized);
};

export const isPrivateAddress = (ip: string): boolean => {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return false;
};

const hostnameOf = (parsed: URL): string => parsed.hostname.replace(/^\[|\]$/g, '');

type ValidateOptions = {
  enforce?: boolean;
};

/**
 * Synchronous policy check, usable in zod refinements.
 * Returns an error message fragment ("must ...") or null when the URL is allowed.
 */
export const validateWebhookUrl = (
  url: string,
  { enforce = isEnforcedEnvironment() }: ValidateOptions = {},
): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'must be a valid URL';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return 'must use http or https';
  if (!enforce) return null;

  if (parsed.protocol !== 'https:') return 'must use https';

  const hostname = hostnameOf(parsed);
  if (hostname === 'localhost' || hostname.endsWith('.localhost'))
    return 'must not target a private or internal address';
  if (isPrivateAddress(hostname)) return 'must not target a private or internal address';

  return null;
};

type ResolveOptions = ValidateOptions & {
  lookupFn?: (hostname: string) => Promise<Array<{ address: string }>>;
};

const defaultLookup = (hostname: string) => lookup(hostname, { all: true });

/**
 * Delivery-time policy check: re-runs the synchronous validation (the URL may
 * predate the policy or have been written through another path), then resolves
 * the hostname and rejects URLs whose DNS answers include private addresses.
 * Unresolvable hostnames pass — delivery will fail as unreachable on its own.
 */
export const resolveWebhookUrlBlockReason = async (
  url: string,
  { enforce = isEnforcedEnvironment(), lookupFn = defaultLookup }: ResolveOptions = {},
): Promise<string | null> => {
  const syncError = validateWebhookUrl(url, { enforce });
  if (syncError) return syncError;
  if (!enforce) return null;

  const hostname = hostnameOf(new URL(url));
  if (isIP(hostname)) return null;

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookupFn(hostname);
  } catch {
    return null;
  }

  if (addresses.some(({ address }) => isPrivateAddress(address))) {
    return 'must not resolve to a private or internal address';
  }
  return null;
};
