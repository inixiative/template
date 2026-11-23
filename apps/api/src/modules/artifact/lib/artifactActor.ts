/**
 * @atlas
 * @kind utils
 * @partOf feature:files
 * @uses primitive:requestContext
 */
import type { User } from '@template/db/generated/client/client';
import type { Permix } from '@template/permissions/client';
import type { Context } from 'hono';
import { actingUser } from '#/lib/context/actingUser';
import type { TokenWithRelations } from '#/lib/context/types';
import type { AppEnv } from '#/types/appEnv';

export type ArtifactActor = {
  user: User | null;
  token: TokenWithRelations | null;
  permix: Permix;
};

export const artifactActorFromContext = (c: Context<AppEnv>): ArtifactActor => ({
  user: actingUser(c),
  token: c.get('token'),
  permix: c.get('permix'),
});
