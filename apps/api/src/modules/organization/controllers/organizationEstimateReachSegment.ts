/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates
 */
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationEstimateReachSegmentRoute } from '#/modules/organization/routes/organizationEstimateReachSegment';
import { estimateSegmentReach } from '#/modules/segment/services/estimateSegmentReach';

export const organizationEstimateReachSegmentController = makeController(
  organizationEstimateReachSegmentRoute,
  async (c, respond) => {
    const organization = contextResource<'organization'>(c);
    const { conditions } = c.req.valid('json');
    return respond.ok({
      count: await estimateSegmentReach('Organization', organization.id, conditions),
    });
  },
);
