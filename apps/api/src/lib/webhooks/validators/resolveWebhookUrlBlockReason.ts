import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { hostnameOf } from '#/lib/webhooks/validators/hostnameOf';
import { isEnforcedEnvironment } from '#/lib/webhooks/validators/isEnforcedEnvironment';
import { isPrivateAddress } from '#/lib/webhooks/validators/isPrivateAddress';
import { type ValidateOptions, validateWebhookUrl } from '#/lib/webhooks/validators/validateWebhookUrl';

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
