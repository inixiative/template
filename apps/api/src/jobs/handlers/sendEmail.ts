import type { CommunicationCategory } from '@template/db';
import type { EmailClient } from '@template/email/client';
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
  from: string;
  template: string;
  data: Record<string, unknown>;
  senderVars: Record<string, unknown>;
  tags?: string[];
  category: CommunicationCategory;
  emailContext?: EmailContext;
};

const chunk = <T>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { recipients, from, template, data, senderVars, tags, emailContext } = payload;
  const { log } = ctx;

  if (!recipients.length) return;

  const { resolveEmailClient } = await import('#/appEvents/bridges/resolveEmailClient');
  const client = await resolveEmailClient(emailContext ?? {});

  const composed = await composeTemplate(template, {
    ownerModel: 'default',
    locale: 'en',
  });

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

  if (client.sendBatch && rendered.length > 1) {
    const batchSize = client.maxBatchSize ?? 100;
    for (const batch of chunk(rendered, batchSize)) {
      await sendBatch(client, batch, log);
    }
  } else {
    for (const email of rendered) {
      await sendSingle(client, email, log);
    }
  }

  log(`Email sent: template=${template} recipients=${recipients.length}`);
});

const sendBatch = async (
  client: EmailClient,
  batch: { to: string; from: string; subject: string; html: string; tags?: string[] }[],
  log: (msg: string) => void,
): Promise<void> => {
  try {
    await client.sendBatch!(batch);
    log(`Batch sent: ${batch.length} emails`);
  } catch (err) {
    log(`Batch failed, falling back to individual sends: ${err}`);
    for (const email of batch) {
      await sendSingle(client, email, log);
    }
  }
};

const sendSingle = async (
  client: EmailClient,
  email: { to: string; from: string; subject: string; html: string; tags?: string[] },
  log: (msg: string) => void,
): Promise<void> => {
  const result = await client.send(email);
  if (!result.success) {
    log(`Email send failed: to=${email.to}`);
    throw new Error(`Email delivery failed for ${email.to}`);
  }
};
