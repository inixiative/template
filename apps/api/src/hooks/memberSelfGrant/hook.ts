/**
 * @atlas
 * @kind hook
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  registerDbHook,
  toEntitlementCreateData,
} from '@template/db';
import type { Entitlement } from '@template/db/generated/client/client';
import {
  isMemberSelfGrant,
  type MemberResource,
  memberSelfGrant,
  toEntitlementEntry,
  toEntitlementInput,
} from '@template/permissions';
import { castArray, keyBy } from 'lodash-es';
import { makeError } from '#/lib/errors';

type MemberModel = 'OrganizationUser' | 'SpaceUser';
type Member = { id: string; userId: string; deletedAt: Date | null };

const MEMBER_MODELS: readonly MemberModel[] = ['OrganizationUser', 'SpaceUser'];

const resourceOf: Record<MemberModel, MemberResource> = {
  OrganizationUser: 'db:organizationUser',
  SpaceUser: 'db:spaceUser',
};

const isMemberModel = (model: string): model is MemberModel =>
  MEMBER_MODELS.includes(model as MemberModel);

const createdMembers = ({ action, result, previous }: HookOptions): Member[] =>
  action === DbAction.upsert && previous ? [] : (castArray(result ?? []) as Member[]);

// A member created tombstoned (a transferred space's dropped people) carries its self-grant
// tombstoned with it, so reviving the member revives the grant.
const writeSelfGrants = async (model: MemberModel, members: Member[]) => {
  if (!members.length) return;
  await db.entitlement.createManyAndReturn({
    data: members.map((member) => ({
      ...toEntitlementCreateData(toEntitlementInput(memberSelfGrant(resourceOf[model], member)), {
        model,
        id: member.id,
      }),
      deletedAt: member.deletedAt,
    })),
  });
};

const tombstonedRows = ({ result, previous }: HookOptions): Entitlement[] => {
  const before = keyBy(castArray(previous ?? []) as Entitlement[], 'id');
  return (castArray(result ?? []) as Entitlement[]).filter(
    (row) => row.deletedAt != null && before[row.id]?.deletedAt == null,
  );
};

// The self-grant goes only with its member: the cascade from the member's own tombstone.
const assertSelfGrantsKept = async (rows: Entitlement[]) => {
  for (const model of MEMBER_MODELS) {
    const removed = rows.filter((row) => row.targetModel === model);
    if (!removed.length) continue;
    const members = (await db.withDeleted(() =>
      db.delegate(model).findMany({ where: { id: { in: removed.map((row) => row.targetId) } } }),
    )) as Member[];
    const live = keyBy(
      members.filter((member) => member.deletedAt == null),
      'id',
    );
    const dropped = removed.find((row) => {
      const member = live[row.targetId];
      return member && isMemberSelfGrant(resourceOf[model], member)(toEntitlementEntry(row));
    });
    if (dropped) throw makeError({ status: 422, message: 'a member keeps its self-grant' });
  }
};

export const registerMemberSelfGrantHook = () => {
  registerDbHook(
    'memberSelfGrant',
    MEMBER_MODELS,
    HookTiming.after,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.upsert],
    async (options) => {
      if (isMemberModel(options.model))
        await writeSelfGrants(options.model, createdMembers(options));
    },
  );

  registerDbHook(
    'memberSelfGrant:kept',
    'Entitlement',
    HookTiming.after,
    [DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async (options) => {
      const rows = tombstonedRows(options);
      if (rows.length) await assertSelfGrantsKept(rows);
    },
  );
};
