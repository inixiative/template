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
  senderVars: Record<string, unknown>;
  tags?: string[];
  category: CommunicationCategory;
  emailContext?: EmailContext;
};

export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { recipients, cc, bcc, from, template, data, senderVars, tags, emailContext } = payload;
  const { log } = ctx;

  if (!recipients.length) return;

  const { resolveEmailClient } = await import('#/appEvents/bridges/resolveEmailClient');
  const client = await resolveEmailClient(emailContext ?? {});

  const composed = await composeTemplate(template, {
    ownerModel: 'default',
    locale: 'en',
  });

  const isGroup = cc?.length || bcc?.length;

  if (isGroup) {
    const variables: Variables = {
      sender: senderVars,
      recipient: { name: recipients[0]?.name ?? '', email: recipients[0]?.to ?? '' },
      data,
    };

    const mjml = interpolate(composed.mjml, variables);
    const subject = interpolate(composed.subject, variables);
    const { html } = mjml2html(mjml, { validationLevel: 'skip' });

    await client.send({
      to: recipients.map((r) => r.to),
      cc,
      bcc,
      from,
      subject,
      html,
      tags,
    });
  } else {
    const rendered = recipients.map((recipient) => {
      const variables: Variables = {
        sender: senderVars,
        recipient: { name: recipient.name, email: recipient.to },
        data,
      };

      const mjml = interpolate(composed.mjml, variables);
      const subject = interpolate(composed.subject, variables);
      const { html } = mjml2html(mjml, { validationLevel: 'skip' });

      return { to: recipient.to, from, subject, html, tags };
    });

    await client.sendBatch(rendered);
  }

  log(`Email sent: template=${template} recipients=${recipients.length}${isGroup ? ` cc=${cc?.length ?? 0} bcc=${bcc?.length ?? 0}` : ''}`);
});
