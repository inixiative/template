/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import { interpolate, type RuleErrorSink, type Variables } from '@template/email/render';
import { LogScope, log } from '@template/shared/logger';
import mjml2html from 'mjml';
import { makeJob } from '#/jobs/makeJob';
import { emailRegistry } from '#/lib/email';

export type DeliverEmailPayload = {
  adapterName: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  from: string;
  subjectTemplate: string;
  mjmlTemplate: string;
  variables: Variables;
  tags: string[];
};

// One recipient, one send. The enqueuer keys this job idempotently so a retry never
// double-sends. Render is best-effort: a malformed rule block degrades (drops) and is
// logged — the fail-vs-degrade decision was already made by sendEmail at compose time.
export const deliverEmail = makeJob<DeliverEmailPayload>(async (_ctx, payload) => {
  const { adapterName, to, cc, bcc, from, subjectTemplate, mjmlTemplate, variables, tags } = payload;

  const errors: string[] = [];
  const onError: RuleErrorSink = (message) => errors.push(message);

  const mjml = interpolate(mjmlTemplate, variables, onError);
  const subject = interpolate(subjectTemplate, variables, onError);
  const { html } = await mjml2html(mjml, { validationLevel: 'skip' });

  if (errors.length) {
    log.warn(`deliverEmail: rule errors for ${to} — ${[...new Set(errors)].join('; ')}`, LogScope.email);
  }

  const client = emailRegistry.getOrDefault(undefined, adapterName);
  await client.send({ to, cc, bcc, from, subject, html, tags });
});
