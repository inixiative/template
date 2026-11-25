/**
 * @atlas
 * @kind service
 * @partOf feature:users
 * @uses infrastructure:prisma, feature:auth
 */
import { createHash, randomBytes } from 'node:crypto';
import { type HydratedRecord, hydrate } from '@template/db';
import type { TokenOwnerModel } from '@template/db/generated/client/enums';
import { type DelegatePermissions, TokenAction } from '@template/permissions';
import { check, schemaMap } from '@template/permissions/rebac';
import type { Context } from 'hono';
import { omit } from 'lodash-es';
import { makeError } from '#/lib/errors';
import { changeEntitlements } from '#/lib/permissions/changeEntitlements';
import { validateDelegateRole } from '#/lib/permissions/validateDelegateRole';
import { validateFullGrant } from '#/lib/permissions/validateFullGrant';
import { assertNotSuperadminTokenWithTwoFactor } from '#/lib/twoFactor/assertNotSuperadminTokenWithTwoFactor';
import { assertRecentTwoFactor } from '#/lib/twoFactor/assertRecentTwoFactor';
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
  const row = omit(params, ['name', 'expiresAt']);
  const permix = c.get('permix');
  const pseudo = await hydrate('token', { id: '', ...row } as HydratedRecord);
  if (!check(permix, 'token', pseudo, TokenAction.create))
    throw makeError({ status: 403, message: 'Access denied' });
  assertNotSuperadminTokenWithTwoFactor(c);
  await assertRecentTwoFactor(c);
  validateDelegateRole(pseudo);
  if (row.full) validateFullGrant(permix, 'token', pseudo);

  const hex = randomBytes(24).toString('hex');
  const modelPrefix = MODEL_PREFIXES[params.ownerModel];
  const rawKey = `${process.env.ENVIRONMENT}_${modelPrefix}_${hex}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = `${process.env.ENVIRONMENT}_${modelPrefix}_${hex.slice(0, 6)}`;

  return db.txn(async () => {
    const token = omit(
      await db.token.create({
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
          expiresAt: params.expiresAt,
        },
      }),
      'keyHash',
    );
    const targetEntitlements = await changeEntitlements(
      permix,
      { model: 'Token', id: token.id },
      { add: params.entitlements ?? [] },
    );
    return { ...token, targetEntitlements, key: rawKey };
  });
};
