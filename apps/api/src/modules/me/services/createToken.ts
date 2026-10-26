/**
 * @atlas
 * @kind service
 * @partOf feature:users
 * @uses infrastructure:prisma, feature:auth
 */
import { createHash, randomBytes } from 'node:crypto';
import { type HydratedRecord, hydrate, Prisma } from '@template/db';
import type { TokenOwnerModel } from '@template/db/generated/client/enums';
import { type DelegatePermissions, TokenAction } from '@template/permissions';
import { check, rebacSchema } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { validateEntitlementGrants } from '#/lib/permissions/validateEntitlementGrants';
import type { AppEnv } from '#/types/appEnv';

const MODEL_PREFIXES: Record<TokenOwnerModel, string> = {
  User: 'user',
  Organization: 'org',
  OrganizationUser: 'orgUser',
  Space: 'space',
  SpaceUser: 'spaceUser',
  Integration: 'integration',
};

type CreateTokenParams = DelegatePermissions & {
  name: string;
  ownerModel: TokenOwnerModel;
  userId?: string;
  organizationId?: string;
  spaceId?: string;
  integrationId?: string;
  expiresAt?: Date;
};

export const createToken = async (c: Context<AppEnv>, params: CreateTokenParams) => {
  const db = c.get('db');
  const { name: _name, expiresAt: _expiresAt, ...row } = params;
  const permix = c.get('permix');
  const standIn = await hydrate('token', { id: '', ...row } as HydratedRecord);
  if (
    !check(permix, rebacSchema, 'token', standIn, TokenAction.create) ||
    (row.full && !check(permix, rebacSchema, 'token', standIn, 'own'))
  )
    throw makeError({ status: 403, message: 'Access denied' });
  await validateEntitlementGrants(permix, params.entitlements ?? []);

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
      integrationId: params.integrationId,
      role: params.role,
      full: params.full,
      entitlements: (params.entitlements as Prisma.InputJsonValue | null) ?? Prisma.DbNull,
      expiresAt: params.expiresAt,
    },
  });

  return { ...token, key: rawKey };
};
