/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { mapValues } from 'lodash-es';
import { toJsonSchema } from '#/lib/jsonSchema/toJsonSchema';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { inquiryInfoRoute } from '#/modules/inquiry/routes/inquiryInfo';

export const inquiryInfoController = makeController(inquiryInfoRoute, async (_c, respond) => {
  return respond.ok({
    types: mapValues(inquiryHandlers, (handler) => ({
      sources: handler.sources.map(({ sourceModel }) => sourceModel),
      targets: handler.targets.map(({ targetModel }) => targetModel),
      unique: handler.unique ?? null,
      defaultExpirationDays: handler.defaultExpirationDays ?? null,
      content: toJsonSchema(handler.contentSchema, 'input'),
      resolutionInput: toJsonSchema(handler.resolutionInputSchema, 'input'),
      resolution: toJsonSchema(handler.resolutionSchema, 'output'),
    })),
  });
});
