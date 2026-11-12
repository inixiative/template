/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates, mutex
 */
import type { Prisma } from '@template/db';
import { emitAppEvent } from '#/appEvents/emit';
import { getResource } from '#/lib/context/getResource';
import { withOwnerLock } from '#/lib/locks/withOwnerLock';
import { makeController } from '#/lib/utils/makeController';
import { segmentOwnerId } from '#/modules/segment/lib/segmentOwner';
import { segmentUpdateRoute } from '#/modules/segment/routes/segmentUpdate';
import { withSegmentRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';

export const segmentUpdateController = makeController(segmentUpdateRoute, async (c, respond) => {
  const db = c.get('db');
  const segment = getResource<'segment'>(c);
  const body = c.req.valid('json');

  const save = () =>
    db.segment.update({
      where: { id: segment.id },
      data: body as Prisma.SegmentUncheckedUpdateInput,
    });

  // A conditions save validates against the owner's reference graph (the cycle check) and then
  // writes into it, so the owner's rule saves run one at a time; a save that leaves the conditions
  // alone never waits.
  const updated =
    (body as { conditions?: unknown }).conditions !== undefined
      ? await withOwnerLock(
          { ownerModel: segment.ownerModel, ownerId: segmentOwnerId(segment) },
          'rules',
          save,
        )
      : await save();

  await emitAppEvent('segment.updated', { segment: updated, previous: segment });

  return respond.ok(await withSegmentRuleIssues(updated));
});
