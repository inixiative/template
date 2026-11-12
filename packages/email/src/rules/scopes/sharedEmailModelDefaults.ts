/**
 * @atlas
 * @kind config
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { NarrowingDefaults } from '@inixiative/json-rules';
import { polymorphicIs } from '@template/db';
import { boundAndLive, platformOrBound, through } from '@template/db/lens';

const tag = platformOrBound('Tag', 'ownerModel');
const segment = boundAndLive('Segment', 'ownerModel');

export const SHARED_EMAIL_MODEL_DEFAULTS: NarrowingDefaults['models'] = {
  Tag: { where: tag, sources: { id: { label: 'name', where: tag } } },
  Segment: { where: segment, sources: { id: { label: 'name', where: segment } } },
  TagAttachment: { where: through('tag', tag) },
  SegmentMember: { where: through('segment', segment) },
  CustomerRef: { where: polymorphicIs('CustomerRef', 'providerModel') },
};
