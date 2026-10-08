/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { ruleReferences, syncRuleReferenceEdges } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import {
  customerRefLens,
  resolvedCustomerRefLens,
} from '#/modules/customerRef/lib/customerRefLens';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';

export const syncSegmentEdges = (segment: Segment, mode: 'save' | 'rebuild' = 'save') =>
  syncRuleReferenceEdges(
    { model: 'Segment', id: segment.id },
    segment.conditions ? ruleReferences(customerRefLens, segment.conditions as Condition) : [],
    mode === 'rebuild'
      ? 'rebuild'
      : { lenses: [resolvedCustomerRefLens(segment.ownerModel, segmentOwnerId(segment))] },
  );
