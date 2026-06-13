/**
 * @atlas
 * @kind validator
 * @partOf feature:webhooks
 * @uses primitive:errors
 */
import { makeError } from '#/lib/errors';
import { hostnameOf } from '#/lib/webhooks/validators/hostnameOf';
import { isEnforcedEnvironment } from '#/lib/webhooks/validators/isEnforcedEnvironment';
import { isPrivateAddress } from '#/lib/webhooks/validators/isPrivateAddress';

export type ValidateOptions = {
  enforce?: boolean;
};

// Synchronous SSRF policy check — throws on the first violation, returns nothing.
export const validateWebhookUrl = (url: string, { enforce = isEnforcedEnvironment() }: ValidateOptions = {}): void => {
  let parsed: URL;
  // must be a parseable URL
  try {
    parsed = new URL(url);
  } catch {
    throw makeError({ status: 400, message: 'Webhook URL must be a valid URL' });
  }

  // scheme is restricted to http/https in every environment
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    throw makeError({ status: 400, message: 'Webhook URL must use http or https' });

  // relaxed environments (local) allow http + private hosts for development loops
  if (!enforce) return;

  // deployed environments require https
  if (parsed.protocol !== 'https:') throw makeError({ status: 400, message: 'Webhook URL must use https' });

  // ...and must not target localhost or a literal private/internal address
  const hostname = hostnameOf(parsed);
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || isPrivateAddress(hostname))
    throw makeError({ status: 400, message: 'Webhook URL must not target a private or internal address' });
};
