import {
  OrganizationScalarSchema,
  OrganizationUserScalarSchema,
  SpaceScalarSchema,
  SpaceUserScalarSchema,
} from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

const responseSchema = tokenReadResponseSchema.extend({
  organization: OrganizationScalarSchema.nullable(),
  organizationUser: OrganizationUserScalarSchema.nullable(),
  space: SpaceScalarSchema.nullable(),
  spaceUser: SpaceUserScalarSchema.nullable(),
});

export const meReadManyTokensRoute = readRoute({
  model: Modules.me,
  submodel: Modules.token,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Token') },
  responseSchema,
  tags: [Tags.me, Tags.token],
});
