/**
 * @atlas
 * @kind service
 * @partOf feature:users
 * @uses infrastructure:prisma, feature:auth
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Prisma } from '@template/db';
import type { Role, TokenOwnerModel } from '@template/db/generated/client/enums';
import type { Entitlements } from '@template/permissions';
import type { Context } from 'hono';
import {
  type RequestedIntegrationReach,
  resolveIntegrationReach,
} from '#/lib/permissions/resolveIntegrationReach';
import { validateTokenBinding } from '#/modules/token/validations/validateTokenBinding';
import type { AppEnv } from '#/types/appEnv';

const MODEL_PREFIXES: Record<TokenOwnerModel, string> = {
  User: 'user',
  Organization: 'org',
  OrganizationUser: 'orgUser',
  Space: 'space',
  SpaceUser: 'spaceUser',
};

type CreateTokenParams = RequestedIntegrationReach & {
  name: string;
  ownerModel: TokenOwnerModel;
  userId?: string | null;
  organizationId?: string | null;
  spaceId?: string | null;
  integrationId?: string;
  role: Role;
  entitlements?: Entitlements;
  entitlementsOnly?: boolean;
  expiresAt?: Date;
};

export const createToken = async (c: Context<AppEnv>, params: CreateTokenParams) => {
  const db = c.get('db');
  const integrationId = params.integrationId ?? null;
  await validateTokenBinding(c, { ...params, integrationId });
  const reach = await resolveIntegrationReach(params, integrationId, params);
  const hex = randomBytes(24).toString('hex');
  const modelPrefix = MODEL_PREFIXES[params.ownerModel];
  const rawKey = `${process.env.ENVIRONMENT}_${modelPrefix}_${hex}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = `${process.env.ENVIRONMENT}_${modelPrefix}_${hex.slice(0, 6)}`;

  const { keyHash: _keyHash, ...token } = await db.token.create({
    data: {
      name: params.name,
      keyHash,
      keyPrefix,
      ownerModel: params.ownerModel,
      userId: params.userId,
      organizationId: params.organizationId,
      spaceId: params.spaceId,
      integrationId,
      role: params.role,
      entitlements: (params.entitlements ?? undefined) as Prisma.InputJsonValue | undefined,
      entitlementsOnly: params.entitlementsOnly,
      expiresAt: params.expiresAt,
      ...reach,
    },
  });

  return { ...token, key: rawKey };
};
