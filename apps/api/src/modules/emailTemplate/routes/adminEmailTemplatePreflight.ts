/**
 * @atlas
 * @kind route
 * @partOf feature:email, superadmin
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates';
import {
  emailTemplatePreflightBodySchema,
  emailTemplatePreflightResponseSchema,
} from '#/modules/emailTemplate/schemas/emailTemplatePreflight.schema';
import { Modules } from '#/modules/modules';

export const adminEmailTemplatePreflightRoute = actionRoute({
  model: Modules.emailTemplate,
  action: 'preflight',
  admin: true,
  skipId: true,
  bodySchema: emailTemplatePreflightBodySchema,
  responseSchema: emailTemplatePreflightResponseSchema,
  description:
    'Deliverability preflight for an unsaved draft: renders it with sample data and reports content findings (subject, preheader, unsubscribe link, image alt text, tokens that do not resolve, spam-trigger phrases). Observation only — nothing is persisted or blocked.',
});
