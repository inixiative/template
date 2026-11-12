/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { INQUIRY_TYPES } from '@template/permissions';
import { mapValues } from 'lodash-es';
import { schemaGuide } from '#/lib/jsonSchema/schemaGuide';
import { toJsonSchema } from '#/lib/jsonSchema/toJsonSchema';
import { makeController } from '#/lib/utils/makeController';
import { inquiryHandlers } from '#/modules/inquiry/handlers';
import { inquiryInfoRoute } from '#/modules/inquiry/routes/inquiryInfo';
import { inquiryInfoResponseSchema } from '#/modules/inquiry/schemas/inquiryInfoResponseSchema';

const guide = schemaGuide(inquiryInfoResponseSchema);

export const inquiryInfoController = makeController(inquiryInfoRoute, async (_c, respond) => {
  return respond.ok({
    guide,
    types: mapValues(inquiryHandlers, (handler, type: keyof typeof INQUIRY_TYPES) => ({
      sources: INQUIRY_TYPES[type].sources.map(({ model }) => model),
      targets: INQUIRY_TYPES[type].targets.map(({ model }) => model),
      unique: handler.unique ?? null,
      defaultExpirationDays: handler.defaultExpirationDays ?? null,
      content: toJsonSchema(handler.contentSchema, 'input'),
      resolutionInput: toJsonSchema(handler.resolutionInputSchema, 'input'),
      resolution: toJsonSchema(handler.resolutionSchema, 'output'),
    })),
  });
});
