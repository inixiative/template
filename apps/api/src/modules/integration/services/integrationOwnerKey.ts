/**
 * @atlas
 * @kind utils
 * @partOf feature:integrations
 * @uses none
 */
import type { Integration } from '@template/db/generated/client/client';

export const integrationOwnerKey = (
  row: Partial<
    Pick<Integration, 'provider' | 'ownerModel' | 'organizationId' | 'spaceId' | 'userId'>
  >,
) => ({
  provider: row.provider,
  ownerModel: row.ownerModel,
  organizationId: row.organizationId ?? null,
  spaceId: row.spaceId ?? null,
  userId: row.userId ?? null,
});
