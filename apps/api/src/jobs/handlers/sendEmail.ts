import type { CommunicationCategory } from '@template/db';
import { composeTemplate, interpolate, type Variables } from '@template/email/render';
import type { EmailContext } from '#/appEvents/types';
import { makeJob } from '#/jobs/makeJob';

export type SendEmailPayload = {
  to: string;
  from: string;
  template: string;
  variables: Variables;
  tags?: string[];
  category: CommunicationCategory;
  emailContext?: EmailContext;
};

export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { to, from, template, variables, tags, emailContext } = payload;
  const { log } = ctx;

  const { resolveEmailClient } = await import('#/appEvents/bridges/resolveEmailClient');

  const client = await resolveEmailClient(emailContext ?? {});

  const composed = await composeTemplate(template, {
    ownerModel: 'default',
    locale: 'en',
  });

  const mjml = interpolate(composed.mjml, variables);
  const subject = interpolate(composed.subject, variables);

  const mjml2html = (await import('mjml')).default;
  const { html } = mjml2html(mjml, { validationLevel: 'skip' });

  const result = await client.send({
    to,
    from,
    subject,
    html,
    tags,
  });

  if (result.success) {
    log(`Email sent: template=${template} to=${to} id=${result.id}`);
  } else {
    log(`Email send failed: template=${template} to=${to}`);
    throw new Error(`Email delivery failed for ${to}`);
  }
});
