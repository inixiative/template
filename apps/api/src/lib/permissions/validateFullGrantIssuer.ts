/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses primitive:errors
 */
import type { EntitlementGrant } from '@template/permissions';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { getPrincipalGrant } from '#/lib/permissions/getPrincipalGrant';
import type { AppEnv } from '#/types/appEnv';

export const isFullGrant = (
  grant: Pick<EntitlementGrant, 'entitlements' | 'entitlementsOnly'> | null,
) => !grant || (!grant.entitlementsOnly && (grant.entitlements ?? null) === null);

export const issuesFullFromNarrowed = (
  c: Context<AppEnv>,
  grant: Pick<EntitlementGrant, 'entitlements' | 'entitlementsOnly'>,
): boolean => isFullGrant(grant) && !isFullGrant(getPrincipalGrant(c));

export const validateFullGrantIssuer = (
  c: Context<AppEnv>,
  grant: Pick<EntitlementGrant, 'entitlements' | 'entitlementsOnly'>,
): void => {
  if (issuesFullFromNarrowed(c, grant))
    throw makeError({
      status: 403,
      message: 'A narrowed credential cannot issue a full one; name the entitlements',
    });
};
