/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { RuleTarget } from '@inixiative/json-rules';
import { lensFields, ruleGrammar } from '@template/shared/rules';
import { schemaGuide } from '#/lib/jsonSchema/schemaGuide';
import { makeController } from '#/lib/utils/makeController';
import { customerRefLens } from '#/modules/customerRef/lib/customerRefLens';
import { segmentInfoRoute } from '#/modules/segment/routes/segmentInfo';
import { segmentInfoResponseSchema } from '#/modules/segment/schemas/segmentInfoResponseSchema';

const guide = schemaGuide(segmentInfoResponseSchema);

export const segmentInfoController = makeController(segmentInfoRoute, async (_c, respond) => {
  return respond.ok({
    guide,
    types: {
      root: 'CustomerRef',
      ...ruleGrammar(RuleTarget.toPrisma),
      fields: lensFields(customerRefLens),
    },
  });
});
