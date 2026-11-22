/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma, primitive:testFactories
 * @uses none
 */
import { registerFactory } from '@template/db/test/factory';

const segmentMemberFactory = registerFactory('SegmentMember', {
  defaults: () => ({}),
  dependencies: {
    segment: {
      modelName: 'Segment',
      foreignKey: { id: 'segmentId' },
      required: true,
    },
    customerRelationship: {
      modelName: 'CustomerRelationship',
      foreignKey: { id: 'customerRelationshipId' },
      required: true,
    },
  },
});

export const buildSegmentMember = segmentMemberFactory.build;
export const createSegmentMember = segmentMemberFactory.create;
