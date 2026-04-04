import { composeTemplate, interpolate, type Variables } from '@template/email/render';
import mjml2html from 'mjml';
import { emailVerifier } from '#/lib/email';
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
  tags: string[];
};

const senderVars = (): Record<string, unknown> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  address: process.env.PLATFORM_ADDRESS ?? '',
});

const verifyRecipients = async (
  recipients: Recipient[],
  log: (msg: string) => void,
): Promise<Recipient[]> => {
  const verified: Recipient[] = [];

  for (const recipient of recipients) {
    const result = await emailVerifier.verify(recipient.to);

    if (result.status === 'undeliverable') {
      log(`Skipping undeliverable: ${recipient.to} (${result.reason})`);
      continue;
    }

    if (result.isDisposable) {
      log(`Skipping disposable: ${recipient.to}`);
      continue;
    }

    if (result.status === 'risky') {
      log(`Sending to risky address: ${recipient.to} (${result.reason})`);
    }

    verified.push(recipient);
  }

  return verified;
};

export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { recipients: rawRecipients, cc, bcc, from, template, data, tags } = payload;
  const { log } = ctx;

  const recipients = await verifyRecipients(rawRecipients, log);
  if (!recipients.length) {
    log(`All recipients filtered by verification for template=${template}`);
    return;
  }

  const { resolveEmailClient } = await import('#/appEvents/services/email/resolveEmailClient');
  const client = await resolveEmailClient({});

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
