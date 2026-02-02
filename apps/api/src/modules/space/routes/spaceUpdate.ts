import { SpaceScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

// Note: Only basic fields (name, slug) are editable here.
// Deeper space updates (ownership transfer, settings changes) require Inquiry workflow.
export const spaceUpdateRoute = updateRoute({
  model: Modules.space,
  bodySchema: SpaceScalarSchema.pick({ name: true, slug: true }).partial(),
  responseSchema: SpaceScalarSchema,
  middleware: [validatePermission('manage')],
});
