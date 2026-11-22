/**
 * @atlas
 * @kind route
 * @partOf feature:users, feature:auth
 * @uses primitive:routeTemplates
 */
import { UserAction } from '@template/permissions/client';
import { readRoute } from '#/lib/routeTemplates';
import { forbidApiTokenMiddleware } from '#/middleware/auth/forbidApiTokenMiddleware';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { twoFactorStatusResponseSchema } from '#/modules/me/schemas/twoFactorSchemas';
import { Modules } from '#/modules/modules';
import { OpenApiTags } from '#/modules/openApiTags';

export const meReadTwoFactorRoute = readRoute({
  model: Modules.me,
  action: 'twoFactor',
  skipId: true,
  middleware: [forbidApiTokenMiddleware, validatePermission(UserAction.manageTwoFactor)],
  responseSchema: twoFactorStatusResponseSchema,
  description: 'Reads your two-factor authentication status, methods, and registered passkeys.',
  tags: [OpenApiTags.me, OpenApiTags.twoFactor],
});
