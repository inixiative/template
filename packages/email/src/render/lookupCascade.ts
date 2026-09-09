/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { EmailComponent } from '@template/db/generated/client/client';
import { lookupAtOwner } from '@template/email/render/lookup';
import { cascadeLookups } from '@template/email/render/owner';
import type { OwnerScope } from '@template/email/render/types';

export const lookupCascade = async (
  slugs: string[],
  ctx: OwnerScope,
): Promise<Record<string, EmailComponent | undefined>> => {
  if (!slugs.length) return {};

  const lookups = cascadeLookups(ctx, (tier) => lookupAtOwner(null, slugs, ctx, tier).then((r) => r.components));
  const results = await Promise.all(lookups.map((fn) => fn()));

  const merged: Record<string, EmailComponent | undefined> = Object.create(null);
  for (const slug of slugs) {
    merged[slug] = results.find((r) => Object.hasOwn(r, slug))?.[slug];
  }
  return merged;
};
