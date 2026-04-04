import type { CommunicationCategory } from '@template/db';
import { composeTemplate, interpolate, type Variables } from '@template/email/render';
import mjml2html from 'mjml';
import type { EmailContext } from '#/appEvents/types';
import { makeJob } from '#/jobs/makeJob';

type Recipient = {
  to: string;
  name: string;
};

export type SendEmailPayload = {
  recipients: Recipient[];
  cc?: string[];
  bcc?: string[];
  from: string;
  template: string;
  data: Record<string, unknown>;
  tags?: string[];
  category: CommunicationCategory;
  emailContext?: EmailContext;
};

const senderVars = (): Record<string, unknown> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  address: process.env.PLATFORM_ADDRESS ?? '',
});

export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { recipients, cc, bcc, from, template, data, tags, emailContext } = payload;
  const { log } = ctx;

  if (!recipients.length) return;

  const { resolveEmailClient } = await import('#/appEvents/services/email/resolveEmailClient');
  const client = await resolveEmailClient(emailContext ?? {});

  const composed = await composeTemplate(template, {
    ownerModel: 'default',
    locale: 'en',
  });

  const sender = senderVars();

  if (cc?.length || bcc?.length) {
    const variables: Variables = {
      sender,
      recipient: { name: recipients[0]?.name ?? '', email: recipients[0]?.to ?? '' },
      data,
    };

    const mjml = interpolate(composed.mjml, variables);
    const subject = interpolate(composed.subject, variables);
    const { html } = mjml2html(mjml, { validationLevel: 'skip' });

    await client.send({ to: recipients.map((r) => r.to), cc, bcc, from, subject, html, tags });
  } else {
    const rendered = recipients.map((recipient) => {
      const variables: Variables = { sender, recipient: { name: recipient.name, email: recipient.to }, data };
      const mjml = interpolate(composed.mjml, variables);
      const subject = interpolate(composed.subject, variables);
      const { html } = mjml2html(mjml, { validationLevel: 'skip' });
      return { to: recipient.to, from, subject, html, tags };
    });

    await client.sendBatch(rendered);
  }

  log(`Email sent: template=${template} recipients=${recipients.length}`);
});
