/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { EmailComponent } from '@template/db/generated/client/client';
import { fetchEmailRowsAtOwner } from '@template/email/render/fetchEmailRowsAtOwner';
import { fetchersPerOwnerTier } from '@template/email/render/owner';
import type { OwnerScope } from '@template/email/render/types';

export const fetchComponentsThroughOwnerCascade = async (
  slugs: string[],
  ctx: OwnerScope,
): Promise<Record<string, EmailComponent | undefined>> => {
  if (!slugs.length) return {};

  const lookups = fetchersPerOwnerTier(ctx, (tier) =>
    fetchEmailRowsAtOwner(null, slugs, ctx, tier).then((r) => r.components),
  );
  const results = await Promise.all(lookups.map((fn) => fn()));

  const merged: Record<string, EmailComponent | undefined> = Object.create(null);
  for (const slug of slugs) {
    merged[slug] = results.find((r) => Object.hasOwn(r, slug))?.[slug];
  }
  return merged;
};
