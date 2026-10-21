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
    'What segment `conditions` may read: every field `customerRefLens` exposes on `CustomerRef` (`root`), with its kind. `conditions` itself is a json-rules condition; its grammar is `@inixiative/json-rules`, not restated here. A `sourced` field takes the id of a row its owner may name. Public endpoint.',
});
