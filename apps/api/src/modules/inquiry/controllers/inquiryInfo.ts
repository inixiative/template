/**
 * @atlas
 * @kind controller
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import type { z } from '@hono/zod-openapi';
import type { InquiryType } from '@template/db/generated/client/enums';
import { INQUIRY_TYPES } from '@template/permissions';
import { mapValues } from 'lodash-es';
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
  const types = mapValues(inquiryServices, (service, type) => {
    const inquiryType = type as InquiryType;
    return {
      sources: INQUIRY_TYPES[inquiryType].sources.map(({ model }) => model),
      targets: INQUIRY_TYPES[inquiryType].targets.map(({ model }) => model),
      unique: service.unique ?? null,
      defaultExpirationDays: service.defaultExpirationDays ?? null,
      content: toJsonSchema(service.contentSchema, 'input'),
      resolutionInput: toJsonSchema(service.resolutionInputSchema, 'input'),
      resolution: toJsonSchema(service.resolutionSchema, 'output'),
    };
  }) as Record<InquiryType, z.input<typeof inquiryTypeInfoSchema>>;

  return respond.ok({ guide, types });
});
