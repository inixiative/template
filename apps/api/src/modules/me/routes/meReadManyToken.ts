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

// Simplified schemas for the include - only the fields we select
const organizationIncludeSchema = OrganizationScalarSchema.pick({ id: true, name: true, slug: true });
const spaceIncludeSchema = SpaceScalarSchema.pick({ id: true, name: true, slug: true, organizationId: true });

const responseSchema = tokenReadResponseSchema.extend({
  organization: organizationIncludeSchema.nullable(),
  organizationUser: OrganizationUserScalarSchema.nullable(),
  space: spaceIncludeSchema.nullable(),
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
