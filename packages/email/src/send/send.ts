import type { Db } from '@template/db';
import mjml2html from 'mjml';
import { composeTemplate, interpolate, type Variables } from '@template/email/render';
import { resolveTargets, resolveTargetsToAddresses } from '@template/email/targeting';
import { emailRegistry, getEmailVerifier } from '@template/email/send/registry';
import { resolveFromAddress } from '@template/email/send/from';
import type { SendEmailInput } from '@template/email/send/types';

const senderVars = (): Record<string, unknown> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  address: process.env.PLATFORM_ADDRESS ?? '',
});

const verifyAddresses = async (
  addresses: string[],
  log: (msg: string) => void,
): Promise<string[]> => {
  const verifier = getEmailVerifier();
  const verified: string[] = [];

  for (const address of addresses) {
    const result = await verifier.verify(address);

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

export const sendEmail = async (
  db: Db,
  input: SendEmailInput,
  log: (msg: string) => void = () => {},
): Promise<void> => {
  const { to, cc, bcc, template, data, sender, tags } = input;

  const [recipients, ccAddresses, bccAddresses, from] = await Promise.all([
    resolveTargets(db, to),
    cc?.length ? resolveTargetsToAddresses(db, cc) : undefined,
    bcc?.length ? resolveTargetsToAddresses(db, bcc) : undefined,
    resolveFromAddress(sender),
  ]);

  if (!recipients.length) return;

  const verified = await verifyAddresses(recipients.map((r) => r.to), log);
  const validRecipients = recipients.filter((r) => verified.includes(r.to));

  if (!validRecipients.length) return;

  const verifiedCc = ccAddresses?.length ? await verifyAddresses(ccAddresses, log) : undefined;
  const verifiedBcc = bccAddresses?.length ? await verifyAddresses(bccAddresses, log) : undefined;

  const defaultAdapterName = emailRegistry.names()[0];
  if (defaultAdapterName === undefined) throw new Error('No email adapters are registered');
  // Stub: always uses first registered adapter. Future: resolve per-tenant via sender context.
  const client = emailRegistry.getOrDefault(undefined, defaultAdapterName);

  // Stub: always default templates, en locale. Future: resolve from sender.ownerModel + locale.
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

    return { to: recipient.to, cc: verifiedCc, bcc: verifiedBcc, from, subject, html, tags };
  });

  await client.sendBatch(rendered);

  log(`Email sent: template=${template} recipients=${rendered.length}`);
};
