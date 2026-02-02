import {
  OrganizationScalarSchema,
  OrganizationUserScalarSchema,
  SpaceScalarSchema,
  SpaceUserScalarSchema,
} from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

const responseSchema = SpaceScalarSchema.extend({
  organization: OrganizationScalarSchema,
  organizationUser: OrganizationUserScalarSchema,
  spaceUser: SpaceUserScalarSchema,
});

export const meReadManySpaceRoute = readRoute({
  model: Modules.me,
  submodel: Modules.space,
  many: true,
  skipId: true,
  paginate: true,
  responseSchema,
  tags: [Tags.me, Tags.space, Tags.spaceUser, Tags.organization, Tags.organizationUser],
});
