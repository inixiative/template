/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import type { Variables } from '@template/email/render';
import mjml2html from 'mjml';
import { makeJob } from '#/jobs/makeJob';
import type { ReachContext } from '#/lib/audience';
import { emailRegistry, resolveFromAddress } from '#/lib/email';
import { settleTemplate } from '#/lib/emailTemplate';

export type DeliverEmailPayload = {
  adapterName: string;
  recipient: { name: string; email: string };
  cc?: string[];
  bcc?: string[];
  template: string;
  context: ReachContext;
  data: Record<string, unknown>;
  tags: string[];
};

const senderVars = (): Record<string, unknown> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  address: process.env.PLATFORM_ADDRESS ?? '',
});

// One recipient, one send. The enqueuer keys this job idempotently so a retry never double-sends.
// settleTemplate resolves the template at this recipient's context (owner cascade + render-error
// policy) and interpolates; we render to HTML and hand off to the adapter.
export const deliverEmail = makeJob<DeliverEmailPayload>(async (_ctx, payload) => {
  const { adapterName, recipient, cc, bcc, template, context, data, tags } = payload;

  const variables: Variables = { sender: senderVars(), recipient, data };
  const [{ subject, mjml }, from] = await Promise.all([
    settleTemplate(template, context, variables),
    resolveFromAddress(),
  ]);
  const { html } = await mjml2html(mjml, { validationLevel: 'skip' });

  const client = emailRegistry.getOrDefault(undefined, adapterName);
  await client.send({ to: recipient.email, cc, bcc, from, subject, html, tags });
});
