/**
 * @atlas
 * @kind hook
 * @partOf feature:billing
 * @uses infrastructure:prisma, primitive:errors
 */
import { DbAction, db, HookTiming, registerDbHook } from '@template/db';
import type { BillingResource } from '@template/db/generated/client/client';
import {
  type BillingAccountOwnerModel,
  BillingResourceTargetModel,
} from '@template/db/generated/client/enums';
import { castArray, chunk } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { assertBillingOwnerAllowed } from '#/modules/billingAccount/services/billingGovernance';

const VALIDATION_CHUNK_SIZE = 2_000;

type OwnerBoundary = {
  organizationId: string | null;
  spaceId: string | null;
  userId: string | null;
};

type AccountBoundary = OwnerBoundary & {
  id: string;
  ownerModel: BillingAccountOwnerModel;
};

type RelationConnectInput = {
  connect?: { id?: string };
  create?: unknown;
  connectOrCreate?: unknown;
};

type LinkRow = Partial<BillingResource> & {
  billingAccount?: RelationConnectInput;
};

const extractBillingAccountId = (row: LinkRow): string | undefined => {
  if (typeof row.billingAccountId === 'string' && row.billingAccountId.length > 0) {
    return row.billingAccountId;
  }
  const nested = row.billingAccount;
  if (!nested) return undefined;
  if (nested.create !== undefined || nested.connectOrCreate !== undefined) {
    throw makeError({
      status: 422,
      message:
        'BillingResource requires an existing billingAccountId; nested create/connectOrCreate is not allowed',
    });
  }
  if (typeof nested.connect?.id === 'string' && nested.connect.id.length > 0) {
    return nested.connect.id;
  }
  throw makeError({
    status: 422,
    message: 'BillingResource billingAccountId must reference an existing record by id',
  });
};

const fetchAccountsMap = async (ids: string[]): Promise<Map<string, AccountBoundary>> => {
  const byId = new Map<string, AccountBoundary>();
  for (const batch of chunk(ids, VALIDATION_CHUNK_SIZE)) {
    const rows = await db.billingAccount.findMany({
      where: { id: { in: batch }, deletedAt: null },
      select: { id: true, ownerModel: true, organizationId: true, spaceId: true, userId: true },
    });
    for (const row of rows) byId.set(row.id, row);
  }
  return byId;
};

const resolveTargetBoundary = async (row: LinkRow): Promise<OwnerBoundary> => {
  switch (row.resourceModel) {
    case BillingResourceTargetModel.Space: {
      const space = await db.space.findFirstOrThrow({
        where: {
          id: row.resourceSpaceId ?? '',
          organizationId: row.resourceOrganizationId ?? '',
          deletedAt: null,
        },
        select: { id: true, organizationId: true },
      });
      return { organizationId: space.organizationId, spaceId: space.id, userId: null };
    }

    case BillingResourceTargetModel.OrganizationUser: {
      const member = await db.organizationUser.findFirstOrThrow({
        where: {
          organizationId: row.resourceOrganizationId ?? '',
          userId: row.resourceUserId ?? '',
          deletedAt: null,
        },
        select: { organizationId: true, userId: true },
      });
      return { organizationId: member.organizationId, spaceId: null, userId: member.userId };
    }

    case BillingResourceTargetModel.SpaceUser: {
      const member = await db.spaceUser.findFirstOrThrow({
        where: {
          organizationId: row.resourceOrganizationId ?? '',
          spaceId: row.resourceSpaceId ?? '',
          userId: row.resourceUserId ?? '',
          deletedAt: null,
        },
        select: { organizationId: true, spaceId: true, userId: true },
      });
      return {
        organizationId: member.organizationId,
        spaceId: member.spaceId,
        userId: member.userId,
      };
    }

    case BillingResourceTargetModel.Project:
      return db.project.findFirstOrThrow({
        where: { id: row.resourceProjectId ?? '', deletedAt: null },
        select: { organizationId: true, spaceId: true, userId: true },
      });

    case BillingResourceTargetModel.ProjectIntegration: {
      const pi = await db.projectIntegration.findFirstOrThrow({
        where: {
          id: row.resourceProjectIntegrationId ?? '',
          deletedAt: null,
          project: { deletedAt: null },
          integration: { deletedAt: null },
        },
        select: {
          project: {
            select: { organizationId: true, spaceId: true, userId: true },
          },
        },
      });
      return {
        organizationId: pi.project.organizationId,
        spaceId: pi.project.spaceId,
        userId: pi.project.userId,
      };
    }

    default:
      throw makeError({ status: 422, message: 'Invalid BillingResource resourceModel' });
  }
};

const assertContainment = (account: AccountBoundary, target: OwnerBoundary): void => {
  if (target.organizationId !== account.organizationId) {
    throw makeError({
      status: 422,
      message: 'BillingAccount and target must belong to the same organization',
    });
  }
  if (account.spaceId !== null && target.spaceId !== account.spaceId) {
    throw makeError({
      status: 422,
      message: 'Space-scoped BillingAccount can only bind to targets in the same space',
    });
  }
  if (account.userId !== null && target.userId !== account.userId) {
    throw makeError({
      status: 422,
      message: 'User-scoped BillingAccount can only bind to targets owned by the same user',
    });
  }
  if (target.organizationId === null && target.userId !== account.userId) {
    throw makeError({
      status: 422,
      message: 'Personal BillingAccount can only bind to personal targets owned by the same user',
    });
  }
};

const validateCreateRows = async (rows: LinkRow[]): Promise<void> => {
  const accountIds: string[] = [];
  const extracted: Array<{ row: LinkRow; billingAccountId: string }> = [];

  for (const row of rows) {
    const billingAccountId = extractBillingAccountId(row);
    if (!billingAccountId) continue;
    accountIds.push(billingAccountId);
    extracted.push({ row, billingAccountId });
  }

  if (extracted.length === 0) return;

  const accountsById = await fetchAccountsMap([...new Set(accountIds)]);

  for (const { row, billingAccountId } of extracted) {
    const account = accountsById.get(billingAccountId);
    if (!account) {
      throw makeError({ status: 422, message: `BillingAccount ${billingAccountId} not found` });
    }
    const target = await resolveTargetBoundary(row);
    assertContainment(account, target);
    await assertBillingOwnerAllowed(account);
  }
};

const IMMUTABLE_LINK_FIELDS = [
  'billingAccountId',
  'billingAccount',
  'resourceModel',
  'resourceOrganizationId',
  'resourceSpaceId',
  'resourceUserId',
  'resourceProjectId',
  'resourceProjectIntegrationId',
  'resourceSpace',
  'resourceOrganizationUser',
  'resourceSpaceUser',
  'resourceProject',
  'resourceProjectIntegration',
] as const;

const assertNoImmutableLinkMutation = (patch?: LinkRow) => {
  if (!patch) return;
  const record = patch as Record<string, unknown>;
  for (const field of IMMUTABLE_LINK_FIELDS) {
    if (field in record && record[field] !== undefined) {
      throw makeError({
        status: 422,
        message: 'BillingResource binding fields cannot be modified after creation',
      });
    }
  }
};

export const registerBillingResourceOwnerHook = () => {
  registerDbHook(
    'billingResourceOwner:create',
    'BillingResource',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn],
    async ({ args }) => {
      const data = (args as { data?: LinkRow | LinkRow[] }).data;
      if (!data) return;
      await validateCreateRows(castArray(data));
    },
  );

  registerDbHook(
    'billingResourceOwner:upsert',
    'BillingResource',
    HookTiming.before,
    [DbAction.upsert],
    async ({ args }) => {
      const a = args as { create?: LinkRow; update?: LinkRow };
      if (a.create) await validateCreateRows([a.create]);
      assertNoImmutableLinkMutation(a.update);
    },
  );

  registerDbHook(
    'billingResourceOwner:update',
    'BillingResource',
    HookTiming.before,
    [DbAction.update, DbAction.updateManyAndReturn],
    async ({ args }) => {
      assertNoImmutableLinkMutation((args as { data?: LinkRow }).data);
    },
  );
};
