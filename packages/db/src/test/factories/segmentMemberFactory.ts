/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { createFactory } from '@template/db/test/factory';

const segmentMemberFactory = createFactory('SegmentMember', {
  defaults: () => ({}),
  dependencies: {
    segment: {
      modelName: 'Segment',
      foreignKey: { id: 'segmentId' },
      required: true,
    },
    customerRef: {
      modelName: 'CustomerRef',
      foreignKey: { id: 'customerRefId' },
      required: true,
    },
  },
});

export const buildSegmentMember = segmentMemberFactory.build;
export const createSegmentMember = segmentMemberFactory.create;
