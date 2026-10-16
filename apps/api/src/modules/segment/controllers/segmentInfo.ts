/**
 * @atlas
 * @kind controller
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { RuleTarget } from '@inixiative/json-rules';
import { lensFields, ruleGrammar } from '@template/shared/rules';
import { makeController } from '#/lib/utils/makeController';
import { customerRefLens } from '#/modules/customerRef/lib/customerRefLens';
import { segmentConditionExamples } from '#/modules/segment/lib/segmentConditionExamples';
import { segmentInfoRoute } from '#/modules/segment/routes/segmentInfo';

export const segmentInfoController = makeController(segmentInfoRoute, async (_c, respond) => {
  const [example] = segmentConditionExamples;
  return respond.ok({
    root: 'CustomerRef',
    example,
    examples: segmentConditionExamples,
    ...ruleGrammar(RuleTarget.toPrisma),
    fields: lensFields(customerRefLens),
  });
});
