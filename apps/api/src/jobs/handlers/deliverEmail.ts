/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import type { Variables } from '@template/email/render';
import mjml2html from 'mjml';
import { makeJob } from '#/jobs/makeJob';
import { emailRegistry, type ReachContext, resolveFromAddress } from '#/lib/email';
import { resolveSender } from '#/lib/email/resolveSender';
import { settleTemplate } from '#/lib/emailTemplate';

export type DeliverEmailPayload = {
  adapterName: string;
  template: string;
  sender: ReachContext;
  recipient: { id: string; name: string; email: string };
  cc?: string[];
  bcc?: string[];
  data: Record<string, unknown>;
  tags: string[];
};

export const deliverEmail = makeJob<DeliverEmailPayload>(async (_ctx, payload) => {
  const { adapterName, template, sender, recipient, cc, bcc, data, tags } = payload;

  const variables: Variables = { sender: await resolveSender(sender), recipient, data };
  const [{ subject, mjml }, from] = await Promise.all([
    settleTemplate(template, sender, variables),
    resolveFromAddress(),
  ]);
  const { html } = await mjml2html(mjml, { validationLevel: 'skip' });

  const client = emailRegistry.getOrDefault(undefined, adapterName);
  await client.send({ to: recipient.email, cc, bcc, from, subject, html, tags });
});
