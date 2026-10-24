/**
 * @atlas
 * @kind route
 * @partOf feature:users
 * @uses primitive:routeTemplates
 */

import { SessionAction } from '@template/permissions/client';
import { actionRoute } from '#/lib/routeTemplates';
import { validateSelfPermission } from '#/middleware/validations/validateSelfPermission';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';

export const meRedactRoute = actionRoute({
  model: Modules.me,
  middleware: [validateSelfPermission(SessionAction.redactUser)],
  action: 'redact',
  skipId: true,
  description: 'Permanently redacts your account data (GDPR right to be forgotten)',
  tags: [Tags.me, Tags.user],
});
