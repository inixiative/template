/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import type { z } from '@hono/zod-openapi';
import type { InquiryType } from '@template/db/generated/client/enums';
import { INQUIRY_TYPES } from '@template/permissions';
import { descriptionsBySchemaFieldPath } from '#/lib/jsonSchema/descriptionsBySchemaFieldPath';
import { toJsonSchema } from '#/lib/jsonSchema/toJsonSchema';
import { makeController } from '#/lib/utils/makeController';
import { inquiryInfoRoute } from '#/modules/inquiry/routes/inquiryInfo';
import {
  inquiryInfoResponseSchema,
  type inquiryTypeInfoSchema,
} from '#/modules/inquiry/schemas/inquiryInfoResponseSchema';
import { inquiryServices } from '#/modules/inquiry/services';

const guide = descriptionsBySchemaFieldPath(inquiryInfoResponseSchema);

export const inquiryInfoController = makeController(inquiryInfoRoute, async (_c, respond) => {
  const types = Object.fromEntries(
    (Object.keys(inquiryServices) as InquiryType[]).map((type) => {
      const service = inquiryServices[type];
      return [
        type,
        {
          sources: INQUIRY_TYPES[type].sources.map(({ model }) => model),
          targets: INQUIRY_TYPES[type].targets.map(({ model }) => model),
          unique: service.unique ?? null,
          defaultExpirationDays: service.defaultExpirationDays ?? null,
          content: toJsonSchema(service.contentSchema, 'input'),
          resolutionInput: toJsonSchema(service.resolutionInputSchema, 'input'),
          resolution: toJsonSchema(service.resolutionSchema, 'output'),
        },
      ];
    }),
  ) as Record<InquiryType, z.input<typeof inquiryTypeInfoSchema>>;

  return respond.ok({ guide, types });
});
