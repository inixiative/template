/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationReachSegmentRoute } from '#/modules/organization/routes/organizationReachSegment';
import { estimateSegmentReach } from '#/modules/segment/services/estimateSegmentReach';

export const organizationReachSegmentController = makeController(organizationReachSegmentRoute, async (c, respond) => {
  const organization = getResource<'organization'>(c);
  const { conditions } = c.req.valid('json');
  return respond.ok({
    count: await estimateSegmentReach('Organization', organization.id, conditions, c.get('db')),
  });
});
