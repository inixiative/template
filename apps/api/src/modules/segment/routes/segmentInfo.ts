/**
 * @atlas
 * @kind route
 * @partOf feature:segment
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { segmentInfoResponseSchema } from '#/modules/segment/schemas/segmentInfoResponseSchema';

export const segmentInfoRoute = readRoute({
  model: Modules.segment,
  action: 'info',
  skipId: true,
  responseSchema: segmentInfoResponseSchema,
  description:
    'The grammar of segment `conditions`: a json-rules condition evaluated against each `CustomerRef` (`root`). Lists the node kinds, the operators each field kind takes and the operand shape each operator expects, and every field a condition may read with its kind. A `sourced` field takes the id of a row its owner may name (its own live segments, its or platform tags). The grammar is `@inixiative/json-rules`; the fields are `customerRefLens`. Public endpoint.',
});
