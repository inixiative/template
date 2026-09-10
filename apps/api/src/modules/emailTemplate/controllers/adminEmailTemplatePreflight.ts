/**
 * @atlas
 * @kind controller
 * @partOf feature:email, superadmin
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { adminEmailTemplatePreflightRoute } from '#/modules/emailTemplate/routes/adminEmailTemplatePreflight';
import { emailTemplatePreflight } from '#/modules/emailTemplate/services/emailTemplatePreflight';

export const adminEmailTemplatePreflightController = makeController(
  adminEmailTemplatePreflightRoute,
  async (c, respond) => respond.ok(await emailTemplatePreflight(c.req.valid('json'))),
);
