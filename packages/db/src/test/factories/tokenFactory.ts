import { faker } from '@faker-js/faker';
import { createHash, randomBytes } from 'crypto';
import { Role, TokenOwnerModel } from '@template/db/generated/client/enums';
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
      role: Role.member,
      isActive: true,
    };
  },
  dependencies: {
    // Composite FK dependencies - pass empty object in overrides to trigger creation
    // Format: { targetField: sourceField } - read targetField from dep, set sourceField on Token
    user: {
      modelName: 'User',
      foreignKey: { id: 'userId' },
      required: false,
    },
    organization: {
      modelName: 'Organization',
      foreignKey: { id: 'organizationId' },
      required: false,
    },
    organizationUser: {
      modelName: 'OrganizationUser',
      foreignKey: { organizationId: 'organizationId', userId: 'userId' },
      required: false,
    },
    space: {
      modelName: 'Space',
      foreignKey: { organizationId: 'organizationId', id: 'spaceId' },
      required: false,
    },
    spaceUser: {
      modelName: 'SpaceUser',
      foreignKey: { organizationId: 'organizationId', spaceId: 'spaceId', userId: 'userId' },
      required: false,
    },
  },
});

export const buildToken = tokenFactory.build;
export const createToken = tokenFactory.create;
