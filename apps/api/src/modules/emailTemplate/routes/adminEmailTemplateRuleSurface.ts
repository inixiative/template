/**
 * @atlas
 * @kind route
 * @partOf feature:email, superadmin
 * @uses primitive:routeTemplates
 */
import { actionRoute } from '#/lib/routeTemplates';
import {
  emailTemplateRuleSurfaceBodySchema,
  emailTemplateRuleSurfaceResponseSchema,
} from '#/modules/emailTemplate/schemas/emailTemplateRuleSurface.schema';
import { Modules } from '#/modules/modules';

export const adminEmailTemplateRuleSurfaceRoute = actionRoute({
  model: Modules.emailTemplate,
  action: 'ruleSurface',
  admin: true,
  skipId: true,
  bodySchema: emailTemplateRuleSurfaceBodySchema,
  responseSchema: emailTemplateRuleSurfaceResponseSchema,
  description:
    "The authoring surface for a template slug: the projection the system provides (recipient, sender, data), narrowed by the lens on the slug's default-tier row, exposed for the variable picker and condition builder.",
});
