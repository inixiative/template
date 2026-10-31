/**
 * @atlas
 * @kind hook
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import { type MemberResource, memberSelfGrant } from '@template/permissions';
import { castArray, isEqual } from 'lodash-es';

type Row = Record<string, unknown>;
type MemberModel = 'OrganizationUser' | 'SpaceUser';
type Member = { id: string; userId: string };

const resourceOf: Record<MemberModel, MemberResource> = {
  OrganizationUser: 'db:organizationUser',
  SpaceUser: 'db:spaceUser',
};

const withSelfGrant = (model: MemberModel, member: Member, entitlements: unknown) => {
  const written = Array.isArray(entitlements) ? entitlements : [];
  const grant = memberSelfGrant(resourceOf[model], member);
  return written.some((entry) => isEqual(entry, grant)) ? written : [...written, grant];
};

const onCreate = (model: MemberModel, row: Row) => {
  row.id ??= Bun.randomUUIDv7();
  row.entitlements = withSelfGrant(model, row as Member, row.entitlements);
};

const storedMember = (model: MemberModel, id: string): Promise<Member> =>
  model === 'OrganizationUser'
    ? db.organizationUser.findUniqueOrThrow({ where: { id } })
    : db.spaceUser.findUniqueOrThrow({ where: { id } });

const onWrite = async (model: MemberModel, where: Row, data: Row) => {
  if (!('entitlements' in data) || typeof where.id !== 'string') return;
  data.entitlements = withSelfGrant(model, await storedMember(model, where.id), data.entitlements);
};

export const registerMemberSelfGrantHook = () => {
  registerDbHook(
    'memberSelfGrant',
    ['OrganizationUser', 'SpaceUser'],
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.update, DbAction.upsert],
    async ({ model, action, args }) => {
      const memberModel = model as MemberModel;
      if (action === DbAction.upsert) {
        const { where, create, update } = args as { where: Row; create: Row; update: Row };
        onCreate(memberModel, create);
        return onWrite(memberModel, where, update);
      }
      if (action === DbAction.update) {
        const { where, data } = args as { where: Row; data: Row };
        return onWrite(memberModel, where, data);
      }
      for (const row of castArray((args as { data: Row | Row[] }).data) as Row[])
        onCreate(memberModel, row);
    },
  );
};
