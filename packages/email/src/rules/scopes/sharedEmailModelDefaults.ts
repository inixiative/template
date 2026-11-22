/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { NarrowingDefaults } from '@inixiative/json-rules';
import { conditionPolymorphicAxisPointsAtBoundRow } from '@template/db';
import {
  platformOrPointsAtBoundRow,
  pointsAtBoundRowAndIsNotDeleted,
  rerootConditionUnderRelation,
} from '@template/db/lens';

const tag = platformOrPointsAtBoundRow('Tag', 'ownerModel');
const segment = pointsAtBoundRowAndIsNotDeleted('Segment', 'ownerModel');

export const SHARED_EMAIL_MODEL_DEFAULTS: NarrowingDefaults['models'] = {
  Tag: { where: tag, sources: { id: { label: 'name', where: tag } } },
  Segment: { where: segment, sources: { id: { label: 'name', where: segment } } },
  TagAttachment: { where: rerootConditionUnderRelation('tag', tag) },
  SegmentMember: { where: rerootConditionUnderRelation('segment', segment) },
  CustomerRelationship: {
    where: conditionPolymorphicAxisPointsAtBoundRow('CustomerRelationship', 'providerModel'),
  },
};
