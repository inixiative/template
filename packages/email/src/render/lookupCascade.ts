/**
 * Cascade lookup for components: Space → Org → default (based on context)
 */

import { db } from '@template/db';
import type { EmailComponent } from '@template/db';
import type { SaveContext } from './types';
import { lookupAtSpace, lookupAtOrg, lookupAtDefault, lookupAtAdmin } from './lookup';

type LookupFn = () => Promise<Record<string, EmailComponent>>;

const getLookups = (slugs: string[], ctx: SaveContext): LookupFn[] => {
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
  ctx: SaveContext,
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
