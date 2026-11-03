/**
 * @atlas
 * @kind config
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { LensNarrowing } from '@inixiative/json-rules';
import type { EntitlementResourceModel } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';

/** What an entitlement's `where` reads: the entitled record, which it can name by id. */
export const entitlementWhereLens = (resource: EntitlementResourceModel): LensNarrowing => ({
  parent: lensFor(resource),
  root: { sources: { id: true } },
});
