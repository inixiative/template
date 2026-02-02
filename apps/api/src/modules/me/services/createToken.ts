import { createHash, randomBytes } from 'crypto';
import type { Db } from '@template/db';
import type { Role, TokenOwnerModel } from '@template/db/generated/client/enums';

const MODEL_PREFIXES: Record<TokenOwnerModel, string> = {
  User: 'user',
  Organization: 'org',
  OrganizationUser: 'orgUser',
  Space: 'space',
  SpaceUser: 'spaceUser',
};

type CreateTokenParams = {
  name: string;
  ownerModel: TokenOwnerModel;
  userId?: string;
  organizationId?: string;
  spaceId?: string;
  role: Role;
  expiresAt?: Date;
};

export const createToken = async (db: Db, params: CreateTokenParams) => {
  const hex = randomBytes(24).toString('hex');
  const modelPrefix = MODEL_PREFIXES[params.ownerModel];
  const rawKey = `${process.env.ENVIRONMENT}_${modelPrefix}_${hex}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = `${process.env.ENVIRONMENT}_${modelPrefix}_${hex.slice(0, 6)}`;

  const token = await db.token.create({
    data: {
      name: params.name,
      keyHash,
      keyPrefix,
      ownerModel: params.ownerModel,
      userId: params.userId,
      organizationId: params.organizationId,
      spaceId: params.spaceId,
      role: params.role,
      expiresAt: params.expiresAt,
    },
    omit: { keyHash: true },
  });

  return { ...token, key: rawKey };
};
