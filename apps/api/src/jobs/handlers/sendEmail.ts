/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import {
  type ComposeTemplateResult,
  composeTemplate,
  EmailRenderError,
  interpolate,
  parentOwner,
  type RuleErrorSink,
  type Variables,
} from '@template/email/render';
import type { EmailTarget } from '@template/email/targeting';
import { LogScope, log } from '@template/shared/logger';
import mjml2html from 'mjml';
import { makeJob } from '#/jobs/makeJob';
import { emailRegistry, emailVerifier, resolveFromAddress } from '#/lib/email';
import { resolveTargets, resolveTargetsToAddresses } from '#/lib/resolveTargets';

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

const verifyAddresses = async (addresses: string[]): Promise<string[]> => {
  const verified: string[] = [];

  for (const address of addresses) {
    const result = await emailVerifier.verify(address);

    if (result.status === 'undeliverable') {
      log.info(`Skipping undeliverable: ${address} (${result.reason})`);
      continue;
    }

    if (result.isDisposable) {
      log.info(`Skipping disposable: ${address}`);
      continue;
    }

    if (result.status === 'risky') {
      log.info(`Sending to risky: ${address} (${result.reason})`);
    }

    verified.push(address);
  }

  return verified;
};

export const sendEmail = makeJob<SendEmailPayload>(async (_ctx, payload) => {
  const { to, cc, bcc, template, data, tags } = payload;

  const [recipients, ccAddresses, bccAddresses, from] = await Promise.all([
    resolveTargets(to),
    cc?.length ? resolveTargetsToAddresses(cc) : undefined,
    bcc?.length ? resolveTargetsToAddresses(bcc) : undefined,
    resolveFromAddress(),
  ]);

  if (!recipients.length) return;

  const verified = await verifyAddresses(recipients.map((r) => r.to));
  const validRecipients = recipients.filter((r) => verified.includes(r.to));

  if (!validRecipients.length) return;

  const adapterName = emailRegistry.names()[0];
  if (!adapterName) {
    log.info(`No email adapter registered — skipping send (template=${template})`);
    return;
  }
  // Stub: always uses first registered adapter. Future: resolve per-tenant via sender context.
  const client = emailRegistry.getOrDefault(undefined, adapterName);

  const senderData = senderVars();
  // Stub: always default templates, en locale. Future: resolve per-tenant org/space context here —
  // it threads through the fallback cascade below unchanged.
  const renderCtx = { locale: 'en' };

  // Render the batch for one resolved template, collecting any render-time rule throws via onError.
  const renderBatch = async (composed: ComposeTemplateResult) => {
    const errors: string[] = [];
    const onError: RuleErrorSink = (message) => errors.push(message);

    const messages = await Promise.all(
      validRecipients.map(async (recipient) => {
        const variables: Variables = {
          sender: senderData,
          recipient: { name: recipient.name, email: recipient.to },
          data,
        };

        const mjml = interpolate(composed.mjml, variables, onError);
        const subject = interpolate(composed.subject, variables, onError);
        const { html } = await mjml2html(mjml, { validationLevel: 'skip' });

        return { to: recipient.to, cc: ccAddresses, bcc: bccAddresses, from, subject, html, tags };
      }),
    );

    return { messages, errors };
  };

  // Render-error policy: a clean render sends. On a render throw we always log, then apply the
  // resolved template's onError — degrade (send with the throwing blocks dropped), fallback
  // (re-compose one owner up: Space → Org → default), or fail (throw → retries → DLQ). Base owners
  // (default/admin) aren't author-configurable and have no parent, so they always fail.
  let composed = await composeTemplate(template, { ...renderCtx, ownerModel: 'default' });

  while (true) {
    const { messages, errors } = await renderBatch(composed);

    if (!errors.length) {
      await client.sendBatch(messages);
      log.info(`Email sent: template=${template} recipients=${messages.length}`, LogScope.email);
      return;
    }

    const unique = [...new Set(errors)];
    log.warn(
      `Email render error: template=${template} owner=${composed.ownerModel} — ${unique.join('; ')}`,
      LogScope.email,
    );

    const parent = parentOwner(composed.ownerModel);
    const policy = parent ? composed.onError : 'fail';

    if (policy === 'degrade') {
      await client.sendBatch(messages);
      log.warn(`Email sent degraded: template=${template} recipients=${messages.length}`, LogScope.email);
      return;
    }

    if (policy === 'fallback' && parent) {
      composed = await composeTemplate(template, { ...renderCtx, ownerModel: parent });
      continue;
    }

    throw new EmailRenderError(template, 'render_failed');
  }
});
