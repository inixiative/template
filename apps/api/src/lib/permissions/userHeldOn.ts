/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz, primitive:requestContext
 * @uses infrastructure:prisma
 */
import { type HydratedRecord, hydrate } from '@template/db';
import type { Context } from 'hono';
import type { HeldOn } from '#/lib/permissions/findUnheldActions';
import type { AppEnv } from '#/types/appEnv';

export const userHeldOn = async (c: Context<AppEnv>): Promise<HeldOn[]> => {
  const user = c.get('user');
  if (!user) return [];
  const spaces = await Promise.all(
    (c.get('spaces') ?? []).map(async (space) => ({
      model: 'space' as const,
      record: await hydrate('space', space as HydratedRecord),
    })),
  );
  return [
    { model: 'user', record: user as HydratedRecord },
    ...(c.get('organizations') ?? []).map((organization) => ({
      model: 'organization' as const,
      record: organization as HydratedRecord,
    })),
    ...spaces,
  ];
};
