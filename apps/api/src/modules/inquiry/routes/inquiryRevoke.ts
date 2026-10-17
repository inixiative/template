/**
 * @atlas
 * @kind route
 * @partOf feature:inquiry
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { inquiryVersionSchema } from '#/modules/inquiry/schemas/inquiryVersionSchema';
import { Modules } from '#/modules/modules';

export const inquiryRevokeRoute = actionRoute({
  model: Modules.inquiry,
  action: 'revoke',
  bodySchema: inquiryVersionSchema,
  description: 'Withdraws a standing grant an approved inquiry holds. Either party can revoke.',
  middleware: [validatePermission('revoke')],
});
