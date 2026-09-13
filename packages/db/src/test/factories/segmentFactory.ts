/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { ProviderModel, SegmentType } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const segmentFactory = createFactory('Segment', {
  defaults: () => ({
    name: `${faker.word.adjective()}-${faker.string.alphanumeric(6).toLowerCase()}`,
    ownerModel: ProviderModel.Space,
    type: SegmentType.static,
    conditions: { all: [] },
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
  },
});

export const buildSegment = segmentFactory.build;
export const createSegment = segmentFactory.create;
