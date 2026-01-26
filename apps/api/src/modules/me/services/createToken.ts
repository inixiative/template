import { createHash, randomBytes } from 'crypto';
import type { ExtendedPrismaClient, OrganizationRole, TokenOwnerModel } from '@template/db';
import { env } from '#/config/env';

const MODEL_PREFIXES: Record<TokenOwnerModel, string> = {
  User: 'usr',
  Organization: 'org',
  OrganizationUser: 'ous',
};

type CreateTokenParams = {
  name: string;
  ownerModel: TokenOwnerModel;
  userId?: string;
  organizationId?: string;
  role: OrganizationRole;
  expiresAt?: Date;
};

export const createToken = async (db: ExtendedPrismaClient, params: CreateTokenParams) => {
  const hex = randomBytes(24).toString('hex');
  const modelPrefix = MODEL_PREFIXES[params.ownerModel];
  const rawKey = `${env.ENVIRONMENT}_${modelPrefix}_${hex}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = `${env.ENVIRONMENT}_${modelPrefix}_${hex.slice(0, 6)}`;

  const token = await db.token.create({
    data: {
      name: params.name,
      keyHash,
      keyPrefix,
      ownerModel: params.ownerModel,
      userId: params.userId,
      organizationId: params.organizationId,
      role: params.role,
      expiresAt: params.expiresAt,
    },
    omit: { keyHash: true },
  });

  return { ...token, key: rawKey };
};
