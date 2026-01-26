import { UserScalarSchema } from '@template/db';
import { readRoute } from '#/lib/requestTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meReadRoute = readRoute({
  model: Modules.me,
  skipId: true,
  responseSchema: UserScalarSchema,
  tags: [Tags.User],
});
