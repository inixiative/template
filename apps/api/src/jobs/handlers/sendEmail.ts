import { composeTemplate, interpolate, type Variables } from '@template/email/render';
import mjml2html from 'mjml';
import { resolveTargets, resolveTargetsToAddresses } from '#/appEvents/services/email/resolveTargets';
import type { EmailTarget } from '#/appEvents/types';
import { emailRegistry, emailVerifier, resolveFromAddress } from '#/lib/email';
import { makeJob } from '#/jobs/makeJob';

export type SendEmailPayload = {
  to: EmailTarget[];
  cc?: EmailTarget[];
  bcc?: EmailTarget[];
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
      log(`Sending to risky: ${address} (${result.reason})`);
    }

    verified.push(address);
  }

  return verified;
};

export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { to, cc, bcc, template, data, sender, tags } = payload;
  const { log } = ctx;

  const [recipients, ccAddresses, bccAddresses, from] = await Promise.all([
    resolveTargets(to),
    cc?.length ? resolveTargetsToAddresses(cc) : undefined,
    bcc?.length ? resolveTargetsToAddresses(bcc) : undefined,
    resolveFromAddress(),
  ]);

  if (!recipients.length) return;

  const verified = await verifyAddresses(recipients.map((r) => r.to), log);
  const validRecipients = recipients.filter((r) => verified.includes(r.to));

  if (!validRecipients.length) return;

  const client = emailRegistry.getOrDefault(undefined, emailRegistry.names()[0]);

  const composed = await composeTemplate(template, { ownerModel: 'default', locale: 'en' });
  const senderData = senderVars();

  const rendered = validRecipients.map((recipient) => {
    const variables: Variables = {
      sender: senderData,
      recipient: { name: recipient.name, email: recipient.to },
      data,
    };

    const mjml = interpolate(composed.mjml, variables);
    const subject = interpolate(composed.subject, variables);
    const { html } = mjml2html(mjml, { validationLevel: 'skip' });

    return { to: recipient.to, cc: ccAddresses, bcc: bccAddresses, from, subject, html, tags };
  });

  await client.sendBatch(rendered);

  log(`Email sent: template=${template} recipients=${rendered.length}`);
});
