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

const responseSchema = SpaceScalarSchema.extend({
  organization: OrganizationScalarSchema,
  organizationUser: OrganizationUserScalarSchema,
  spaceUser: SpaceUserScalarSchema,
});

export const meReadManySpacesRoute = readRoute({
  model: Modules.me,
  submodel: Modules.space,
  many: true,
  skipId: true,
  paginate: true,
  filterLens: { parent: lensFor('Space') },
  responseSchema,
  tags: [Tags.me, Tags.space, Tags.spaceUser, Tags.organization, Tags.organizationUser],
});
