/**
 * @atlas
 * @kind service
 * @partOf feature:auth
 * @uses primitive:errors
 */
import { makeError } from '#/lib/errors';
import { matchingCorsOriginUrl, requireAllowedCorsOriginUrl } from '#/middleware/corsMiddleware';

const fallbackOriginFromEnv = (): string | null =>
  process.env.WEB_URL || process.env.ADMIN_URL || process.env.SUPERADMIN_URL || null;

export const twoFactorIssuerName = (): string => process.env.WEBAUTHN_RP_NAME?.trim() || 'App';

const rpIdForHost = (originHost: string): string => {
  const configuredRpId = process.env.WEBAUTHN_RP_ID?.trim().toLowerCase();
  return configuredRpId &&
    (originHost === configuredRpId || originHost.endsWith(`.${configuredRpId}`))
    ? configuredRpId
    : originHost;
};

export const resolveWebAuthnOrigin = (
  rawOrigin: string | undefined,
): { expectedOrigin: string; rpId: string; rpName: string } => {
  const candidate = rawOrigin?.trim() || fallbackOriginFromEnv();
  if (!candidate)
    throw makeError({ status: 400, message: 'Origin header is required for passkey verification' });

  const parsed = requireAllowedCorsOriginUrl(candidate);
  const originHost = parsed.hostname.toLowerCase();
  const isLocalHost = originHost === 'localhost' || originHost === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !isLocalHost)
    throw makeError({ status: 403, message: 'Passkeys require an HTTPS origin' });

  return {
    expectedOrigin: parsed.origin,
    rpId: rpIdForHost(originHost),
    rpName: twoFactorIssuerName(),
  };
};

export const rpIdFromOrigin = (origin: string | undefined): string | undefined => {
  const parsed = origin ? matchingCorsOriginUrl(origin.trim()) : null;
  return parsed ? rpIdForHost(parsed.hostname.toLowerCase()) : undefined;
};
