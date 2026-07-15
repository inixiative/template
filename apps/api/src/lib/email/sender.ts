/**
 * @atlas
 * @kind type
 * @partOf feature:email
 * @uses none
 */
import type { SenderType } from '@template/db/generated/client/client';

export type { SenderType };

export type Sender =
  | { type: 'platform' }
  | { type: 'admin' }
  | { type: 'User'; userId: string }
  | { type: 'Organization'; organizationId: string }
  | { type: 'Space'; spaceId: string; organizationId: string }
  | { type: 'OrganizationUser'; userId: string; organizationId: string }
  | { type: 'SpaceUser'; userId: string; spaceId: string; organizationId: string };
