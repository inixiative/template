/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { SegmentMemberSource } from '@template/db/generated/client/enums';
import { getResource } from '#/lib/context/getResource';
import { makeError } from '#/lib/errors';
import { makeController } from '#/lib/utils/makeController';
import { segmentMemberDeleteRoute } from '#/modules/segmentMember/routes/segmentMemberDelete';

export const segmentMemberDeleteController = makeController(segmentMemberDeleteRoute, async (c, respond) => {
  const db = c.get('db');
  const member = getResource<'segmentMember'>(c);

  if (member.source !== SegmentMemberSource.manual) {
    throw makeError({
      status: 422,
      message: 'Rule-sourced members are owned by reconcile; pin the customer or change the rule instead',
    });
  }

  await db.segmentMember.delete({ where: { id: member.id } });
  return respond.noContent();
});
