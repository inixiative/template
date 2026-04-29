import { z } from '@hono/zod-openapi';
import { ContactScalarSchema } from '@template/db';
import { ContactOwnerModel, ContactType } from '@template/db/generated/client/enums';
import { readRoute } from '#/lib/routeTemplates';
import { advancedSearchSchema, simpleSearchSchema } from '#/lib/routeTemplates/searchSchema';
import { Modules } from '#/modules/modules';

const querySchema = z.object({
  search: simpleSearchSchema,
  searchFields: advancedSearchSchema,
  ownerModel: z.nativeEnum(ContactOwnerModel).optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  spaceId: z.string().uuid().optional(),
  type: z.nativeEnum(ContactType).optional(),
  isPrimary: z.coerce.boolean().optional(),
  isPublic: z.coerce.boolean().optional(),
});

export const adminContactReadManyRoute = readRoute({
  model: Modules.contact,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  query: querySchema,
  searchableFields: ['type', 'subtype', 'label', 'valueKey'],
  responseSchema: ContactScalarSchema,
});
