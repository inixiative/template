/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { faker } from '@faker-js/faker';
import { SegmentType } from '@template/db/generated/client/enums';
import { registerFactory } from '@template/db/test/factory';

const segmentFactory = registerFactory('Segment', {
  defaults: () => ({
    name: `${faker.word.adjective()}-${faker.string.alphanumeric(6).toLowerCase()}`,
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
