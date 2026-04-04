import { composeTemplate, interpolate, type Variables } from '@template/email/render';
import mjml2html from 'mjml';
import { emailVerifier } from '#/lib/email';
import { makeJob } from '#/jobs/makeJob';

type EmailDelivery = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  name: string;
};

export type SendEmailPayload = {
  deliveries: EmailDelivery[];
  from: string;
  template: string;
  data: Record<string, unknown>;
  tags: string[];
};

const senderVars = (): Record<string, unknown> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  address: process.env.PLATFORM_ADDRESS ?? '',
});

const verifyAddresses = async (
  addresses: string[],
  log: (msg: string) => void,
): Promise<string[]> => {
  const verified: string[] = [];

  for (const address of addresses) {
    const result = await emailVerifier.verify(address);

    if (result.status === 'undeliverable') {
      log(`Skipping undeliverable: ${address} (${result.reason})`);
      continue;
    }

    if (result.isDisposable) {
      log(`Skipping disposable: ${address}`);
      continue;
    }

    if (result.status === 'risky') {
      log(`Sending to risky address: ${address} (${result.reason})`);
    }

    verified.push(address);
  }

  return verified;
};

export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { deliveries, from, template, data, tags } = payload;
  const { log } = ctx;

  const valid = deliveries.filter((d) => d.to.length);
  if (!valid.length) return;

  const { resolveEmailClient } = await import('#/appEvents/services/email/resolveEmailClient');
  const client = await resolveEmailClient({});

  const composed = await composeTemplate(template, {
    ownerModel: 'default',
    locale: 'en',
  });

  const sender = senderVars();

  const rendered = [];

  for (const delivery of valid) {
    const to = await verifyAddresses(delivery.to, log);
    if (!to.length) continue;

    const variables: Variables = {
      sender,
      recipient: { name: delivery.name, email: to[0] },
      data,
    };

    const mjml = interpolate(composed.mjml, variables);
    const subject = interpolate(composed.subject, variables);
    const { html } = mjml2html(mjml, { validationLevel: 'skip' });

    rendered.push({ to, cc: delivery.cc, bcc: delivery.bcc, from, subject, html, tags });
  }

  if (!rendered.length) {
    log(`All deliveries filtered by verification for template=${template}`);
    return;
  }

  await client.sendBatch(rendered);

  log(`Email sent: template=${template} deliveries=${rendered.length}`);
});
