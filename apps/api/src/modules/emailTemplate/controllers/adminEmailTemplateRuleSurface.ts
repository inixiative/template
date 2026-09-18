/**
 * @atlas
 * @kind controller
 * @partOf feature:email, superadmin
 * @uses primitive:routeTemplates
 */
import { makeController } from '#/lib/utils/makeController';
import { adminEmailTemplateRuleSurfaceRoute } from '#/modules/emailTemplate/routes/adminEmailTemplateRuleSurface';
import { emailTemplateRuleSurface } from '#/modules/emailTemplate/services/emailTemplateRuleSurface';

export const adminEmailTemplateRuleSurfaceController = makeController(
  adminEmailTemplateRuleSurfaceRoute,
  async (c, respond) => {
    const { slug, locale, ...owner } = c.req.valid('json');
    return respond.ok(await emailTemplateRuleSurface(slug, { ...owner, locale: locale ?? 'en' }));
  },
);
