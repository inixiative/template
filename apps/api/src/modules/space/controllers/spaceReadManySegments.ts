/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { withSegmentsRuleIssues } from '#/modules/segment/services/withSegmentRuleIssues';
import { spaceReadManySegmentsRoute } from '#/modules/space/routes/spaceReadManySegments';

export const spaceReadManySegmentsController = makeController(spaceReadManySegmentsRoute, async (c, respond) => {
  const db = c.get('db');
  const space = getResource<'space'>(c);

  const { data, pagination } = await paginate(c, db.segment, {
    where: { ownerModel: 'Space', spaceId: space.id },
  });

  return respond.ok(await withSegmentsRuleIssues(data, db), { pagination });
});
