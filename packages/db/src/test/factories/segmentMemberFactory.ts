/**
 * @atlas
 * @kind factory
 * @partOf infrastructure:prisma
 * @uses none
 */
import { SegmentMemberSource } from '@template/db/generated/client/enums';
import { createFactory } from '@template/db/test/factory';

const segmentMemberFactory = createFactory('SegmentMember', {
  defaults: () => ({
    source: SegmentMemberSource.manual,
  }),
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
