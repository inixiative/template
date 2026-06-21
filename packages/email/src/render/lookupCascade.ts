/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent } from '@template/db/generated/client/client';
import { lookupAtAdmin, lookupAtDefault, lookupAtOrg, lookupAtSpace } from '@template/email/render/lookup';
import type { OwnerScope } from '@template/email/render/types';

type LookupFn = () => Promise<Record<string, EmailComponent>>;

const getLookups = (slugs: string[], ctx: OwnerScope): LookupFn[] => {
  switch (ctx.ownerModel) {
    case 'Space':
      return [
        () => lookupAtSpace(db, null, slugs, ctx).then((r) => r.components),
        () => lookupAtOrg(db, null, slugs, ctx, true).then((r) => r.components),
        () => lookupAtDefault(db, null, slugs, ctx).then((r) => r.components),
      ];
    case 'Organization':
      return [
        () => lookupAtOrg(db, null, slugs, ctx).then((r) => r.components),
        () => lookupAtDefault(db, null, slugs, ctx).then((r) => r.components),
      ];
    case 'admin':
      return [() => lookupAtAdmin(db, null, slugs, ctx).then((r) => r.components)];
    case 'default':
      return [() => lookupAtDefault(db, null, slugs, ctx).then((r) => r.components)];
  }
};

export const lookupCascade = async (
  slugs: string[],
  ctx: OwnerScope,
): Promise<Record<string, EmailComponent | undefined>> => {
  if (!slugs.length) return {};

  const lookups = getLookups(slugs, ctx);
  const results = await Promise.all(lookups.map((fn) => fn()));

  const merged: Record<string, EmailComponent | undefined> = {};
  for (const slug of slugs) {
    merged[slug] = results.find((r) => r[slug])?.[slug];
  }
  return merged;
};
