/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent, PrismaClient } from '@template/db/generated/client/client';
import {
  lookupAtAdmin,
  lookupAtDefault,
  lookupAtOrg,
  lookupAtOrgUser,
  lookupAtSpace,
  lookupAtSpaceUser,
  lookupAtUser,
} from '@template/email/render/lookup';
import type { OwnerScope } from '@template/email/render/types';

type LookupFn = () => Promise<Record<string, EmailComponent>>;

const getLookups = (client: PrismaClient, slugs: string[], ctx: OwnerScope): LookupFn[] => {
  switch (ctx.ownerModel) {
    case 'Space':
      return [
        () => lookupAtSpace(client, null, slugs, ctx).then((r) => r.components),
        () => lookupAtOrg(client, null, slugs, ctx, true).then((r) => r.components),
        () => lookupAtDefault(client, null, slugs, ctx).then((r) => r.components),
      ];
    case 'Organization':
      return [
        () => lookupAtOrg(client, null, slugs, ctx).then((r) => r.components),
        () => lookupAtDefault(client, null, slugs, ctx).then((r) => r.components),
      ];
    case 'admin':
      return [() => lookupAtAdmin(client, null, slugs, ctx).then((r) => r.components)];
    case 'default':
      return [() => lookupAtDefault(client, null, slugs, ctx).then((r) => r.components)];
    case 'SpaceUser':
      return [
        () => lookupAtSpaceUser(client, null, slugs, ctx).then((r) => r.components),
        () => lookupAtOrgUser(client, null, slugs, ctx).then((r) => r.components),
        () => lookupAtUser(client, null, slugs, ctx).then((r) => r.components),
        () => lookupAtDefault(client, null, slugs, ctx).then((r) => r.components),
      ];
    case 'OrganizationUser':
      return [
        () => lookupAtOrgUser(client, null, slugs, ctx).then((r) => r.components),
        () => lookupAtUser(client, null, slugs, ctx).then((r) => r.components),
        () => lookupAtDefault(client, null, slugs, ctx).then((r) => r.components),
      ];
    case 'User':
      return [
        () => lookupAtUser(client, null, slugs, ctx).then((r) => r.components),
        () => lookupAtDefault(client, null, slugs, ctx).then((r) => r.components),
      ];
  }
};

// Callers running inside a DB hook must pass their bound client: the ambient default resolves
// through storage that a hook frame cannot rely on, and would miss same-transaction writes.
export const lookupCascade = async (
  slugs: string[],
  ctx: OwnerScope,
  client: PrismaClient = db,
): Promise<Record<string, EmailComponent | undefined>> => {
  if (!slugs.length) return {};

  const lookups = getLookups(client, slugs, ctx);
  const results = await Promise.all(lookups.map((fn) => fn()));

  const merged: Record<string, EmailComponent | undefined> = {};
  for (const slug of slugs) {
    merged[slug] = results.find((r) => r[slug])?.[slug];
  }
  return merged;
};
