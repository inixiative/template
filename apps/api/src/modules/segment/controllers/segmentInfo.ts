/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { lensFields } from '@template/shared/rules';
import { descriptionsBySchemaFieldPath } from '#/lib/jsonSchema/descriptionsBySchemaFieldPath';
import { makeController } from '#/lib/utils/makeController';
import { customerRefLens } from '#/modules/customerRef/lib/lenses/customerRefLens';
import { segmentInfoRoute } from '#/modules/segment/routes/segmentInfo';
import { segmentInfoResponseSchema } from '#/modules/segment/schemas/segmentInfoResponseSchema';

const guide = descriptionsBySchemaFieldPath(segmentInfoResponseSchema);

export const segmentInfoController = makeController(segmentInfoRoute, async (_c, respond) => {
  return respond.ok({
    guide,
    types: {
      conditions: 'rule',
      root: 'CustomerRef',
      fields: lensFields(customerRefLens),
    },
  });
});
