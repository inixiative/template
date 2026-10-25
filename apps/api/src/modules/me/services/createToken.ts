/**
 * @atlas
 * @kind service
 * @partOf feature:users
 * @uses infrastructure:prisma, feature:auth
 */
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@template/db';
import type { TokenOwnerModel } from '@template/db/generated/client/enums';
import type { DelegateClaim } from '@template/permissions';
import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import { canGrantDelegateClaim } from '#/lib/permissions/canGrantDelegateClaim';
import { delegateHolder } from '#/lib/permissions/delegateHolder';
import { validateTokenClaim } from '#/lib/permissions/validateDelegateClaim';
import type { AppEnv } from '#/types/appEnv';

const MODEL_PREFIXES: Record<TokenOwnerModel, string> = {
  User: 'user',
  Organization: 'org',
  OrganizationUser: 'orgUser',
  Space: 'space',
  SpaceUser: 'spaceUser',
  Integration: 'integration',
};

type CreateTokenParams = DelegateClaim & {
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
  const claim = { role: params.role, full: params.full, entitlements: params.entitlements };
  validateTokenClaim(params.ownerModel, claim);
  const holder = await delegateHolder({
    ownerModel: params.ownerModel,
    userId: params.userId ?? null,
    organizationId: params.organizationId ?? null,
    spaceId: params.spaceId ?? null,
    integrationId: params.integrationId ?? null,
  });
  if (!(await canGrantDelegateClaim(c.get('permix'), holder, claim)))
    throw makeError({ status: 403, message: 'A token holds your permissions or less' });

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
