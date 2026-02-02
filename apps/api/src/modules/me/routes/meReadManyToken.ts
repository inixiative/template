import {
  OrganizationScalarSchema,
  OrganizationUserScalarSchema,
  SpaceScalarSchema,
  SpaceUserScalarSchema,
} from '@template/db';
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

export const meReadManyTokenRoute = readRoute({
  model: Modules.me,
  submodel: Modules.token,
  many: true,
  skipId: true,
  paginate: true,
  responseSchema,
  tags: [Tags.me, Tags.token],
});
