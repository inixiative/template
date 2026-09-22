/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { createFactory } from '@template/db/test/factory';

const featureFlagVariantFactory = createFactory('FeatureFlagVariant', {
  defaults: () => ({
    label: `${faker.word.adjective()}-${faker.string.alphanumeric(6).toLowerCase()}`,
    position: 0,
    isDefault: false,
    valueBoolean: true,
  }),
  dependencies: {
    featureFlag: {
      modelName: 'FeatureFlag',
      foreignKey: { id: 'featureFlagId' },
      required: true,
    },
    segment: {
      modelName: 'Segment',
      foreignKey: { id: 'segmentId' },
      required: false,
    },
  },
});

export const buildFeatureFlagVariant = featureFlagVariantFactory.build;
export const createFeatureFlagVariant = featureFlagVariantFactory.create;
