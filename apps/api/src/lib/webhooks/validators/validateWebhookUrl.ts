import { hostnameOf } from '#/lib/webhooks/validators/hostnameOf';
import { isEnforcedEnvironment } from '#/lib/webhooks/validators/isEnforcedEnvironment';
import { isPrivateAddress } from '#/lib/webhooks/validators/isPrivateAddress';

export type ValidateOptions = {
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
