/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses primitive:errors
 */
import type { HydratedRecord } from '@template/db';
import { makeError } from '#/lib/errors';

type DelegateRow = { role?: unknown; full?: unknown };

export const validateDelegateRole = (token: HydratedRecord): void => {
  const integration = token.integration as DelegateRow | null | undefined;
  if (token.role && integration && !integration.full && !integration.role)
    throw makeError({
      status: 422,
      message:
        "a token's role narrows its integration's role, and this integration has none: make the token full or give it entitlements",
    });
};
