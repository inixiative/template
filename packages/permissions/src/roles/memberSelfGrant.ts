/**
 * @atlas
 * @kind utils
 * @partOf primitive:authz
 * @uses none
 */
import type { EntitlementEntry } from '@template/permissions/client';
import { isEqual, pick } from 'lodash-es';

export type MemberResource = 'db:organizationUser' | 'db:spaceUser';

export const memberSelfGrant = (
  resource: MemberResource,
  member: { id: string },
): EntitlementEntry => ({
  resource,
  anchor: { resource, id: member.id },
  actions: { operate: true },
});

export const isMemberSelfGrant =
  (resource: MemberResource, member: { id?: string }) => (entry: EntitlementEntry) =>
    !!member.id &&
    isEqual(
      pick(entry, ['resource', 'anchor', 'where', 'actions']),
      memberSelfGrant(resource, { id: member.id }),
    );
