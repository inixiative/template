import { faker } from '@faker-js/faker';
import { createHash, randomBytes } from 'crypto';
import { OrganizationRole, TokenOwnerModel } from '@template/db/generated/client/client';
import { createFactory } from '../factory';

const tokenFactory = createFactory('Token', {
  defaults: () => {
    const rawKey = randomBytes(24).toString('hex');
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    return {
      name: faker.lorem.words(2),
      keyHash,
      keyPrefix: rawKey.slice(0, 16),
      ownerModel: TokenOwnerModel.User,
      role: OrganizationRole.member,
      isActive: true,
    };
  },
  dependencies: {
    // OrganizationUser uses composite FK - pass organizationUser: {} in overrides to create
    organizationUser: {
      modelName: 'OrganizationUser',
      foreignKey: ['organizationId', 'userId'],
      required: false,
    },
  },
});

export const buildToken = tokenFactory.build;
export const createToken = tokenFactory.create;
