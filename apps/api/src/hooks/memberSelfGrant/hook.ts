/**
 * @atlas
 * @kind hook
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { DbAction, HookTiming, registerDbHook } from '@template/db';
import { isMemberSelfGrant, type MemberResource, memberSelfGrant } from '@template/permissions';
import { castArray } from 'lodash-es';

type Row = Record<string, unknown>;
type MemberModel = 'OrganizationUser' | 'SpaceUser';
type Member = { id: string; userId: string };

const resourceOf: Record<MemberModel, MemberResource> = {
  OrganizationUser: 'db:organizationUser',
  SpaceUser: 'db:spaceUser',
};

const withSelfGrant = (model: MemberModel, member: Member, entitlements: unknown) => {
  const written = Array.isArray(entitlements) ? entitlements : [];
  const resource = resourceOf[model];
  return written.some(isMemberSelfGrant(resource, member))
    ? written
    : [...written, memberSelfGrant(resource, member)];
};

const onCreate = (model: MemberModel, row: Row) => {
  row.id ??= Bun.randomUUIDv7();
  row.entitlements = withSelfGrant(model, row as Member, row.entitlements);
};

export const registerMemberSelfGrantHook = () => {
  registerDbHook(
    'memberSelfGrant',
    ['OrganizationUser', 'SpaceUser'],
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.upsert],
    async ({ model, action, args }) => {
      const memberModel = model as MemberModel;
      if (action === DbAction.upsert)
        return onCreate(memberModel, (args as { create: Row }).create);
      for (const row of castArray((args as { data: Row | Row[] }).data) as Row[])
        onCreate(memberModel, row);
    },
  );
};
