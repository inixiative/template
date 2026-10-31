/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { Operator } from '@inixiative/json-rules';
import type { EntitlementEntry } from '@template/permissions/client';
import { isEqual } from 'lodash-es';

export type MemberResource = 'db:organizationUser' | 'db:spaceUser';

export const memberSelfGrant = (
  resource: MemberResource,
  member: { id: string; userId: string },
): EntitlementEntry => ({
  resource,
  anchor: { resource: 'db:user', id: member.userId, path: 'user' },
  where: { field: 'id', operator: Operator.equals, value: member.id },
  actions: { operate: true },
});

export const isMemberSelfGrant =
  (resource: MemberResource, member: { id?: string; userId?: string }) =>
  (entry: EntitlementEntry) => {
    if (!member.id || !member.userId) return false;
    const { actions: _, ...grant } = memberSelfGrant(resource, {
      id: member.id,
      userId: member.userId,
    });
    return isEqual({ resource: entry.resource, anchor: entry.anchor, where: entry.where }, grant);
  };
