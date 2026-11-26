/**
 * @atlas
 * @kind utils
 * @partOf feature:integrations
 * @uses none
 */
import { emptySideKeyColumns, polymorphicAxis, polymorphicKeyColumns } from '@template/db';
import type { Integration } from '@template/db/generated/client/client';
import { pick } from 'lodash-es';

const ownerAxis = polymorphicAxis('Integration', 'ownerModel');

export const integrationProviderOwnerWhere = (
  row: Partial<
    Pick<Integration, 'provider' | 'ownerModel' | 'organizationId' | 'spaceId' | 'userId'>
  >,
) => ({
  provider: row.provider,
  ownerModel: row.ownerModel,
  ...emptySideKeyColumns(ownerAxis),
  ...(row.ownerModel
    ? pick(row, polymorphicKeyColumns('Integration', 'ownerModel', row.ownerModel))
    : {}),
});
