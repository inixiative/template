/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { CustomerModel, FeatureFlagValueType, ProviderModel } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const featureFlagFactory = createFactory('FeatureFlag', {
  defaults: () => ({
    slug: `${faker.word.adjective()}-${faker.string.alphanumeric(6).toLowerCase()}`,
    name: faker.commerce.productName(),
    ownerModel: ProviderModel.platform,
    subjectModel: CustomerModel.User,
    valueType: FeatureFlagValueType.boolean,
    enabled: true,
  }),
  dependencies: {
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
    space: {
      modelName: 'Space',
      foreignKey: { id: 'spaceId' },
      required: false,
    },
    segment: {
      modelName: 'Segment',
      foreignKey: { id: 'segmentId' },
      required: false,
    },
  },
});

export const buildFeatureFlag = featureFlagFactory.build;
export const createFeatureFlag = featureFlagFactory.create;
