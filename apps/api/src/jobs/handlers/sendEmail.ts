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
import { LogScope, log } from '@template/shared/logger';
import { enqueueJob } from '#/jobs/enqueue';
import { makeJob } from '#/jobs/makeJob';
import { type Audience, contextKey, type ReachContext, type Recipient, resolveAudience } from '#/lib/audience';
import { emailRegistry, emailVerifier, resolveFromAddress } from '#/lib/email';

export type SendEmailPayload = {
  to: Audience[];
  cc?: Audience[];
  bcc?: Audience[];
  template: string;
  data: Record<string, unknown>;
  sender?: ReachContext;
  tags: string[];
};

const senderVars = (): Record<string, unknown> => ({
  platformName: process.env.PLATFORM_NAME ?? 'Template',
  address: process.env.PLATFORM_ADDRESS ?? '',
});

const verifyAddresses = async (addresses: string[]): Promise<Set<string>> => {
  const ok = new Set<string>();

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
    if (result.status === 'risky') log.info(`Sending to risky: ${address} (${result.reason})`);

    ok.add(address);
  }

  return ok;
};

const composeCtx = (ctx: ReachContext) => ({
  locale: 'en',
  ownerModel: ctx.ownerModel,
  organizationId: ctx.ownerModel === 'Organization' ? ctx.organizationId : undefined,
  spaceId: ctx.ownerModel === 'Space' ? ctx.spaceId : undefined,
});

// Settle one context's template: compose at the context owner, probe-render once to surface
// template-level rule errors (malformed `{{#if rule=...}}` is recipient-independent), then apply
// the resolved template's policy — degrade (fan out anyway; bad blocks drop per recipient),
// fallback (re-compose one owner up), or fail (throw → DLQ; this context fans out nothing).
const settleTemplate = async (template: string, ctx: ReachContext, probe: Variables): Promise<ComposeTemplateResult> => {
  let composed = await composeTemplate(template, composeCtx(ctx));

  while (true) {
    const errors: string[] = [];
    const onError: RuleErrorSink = (message) => errors.push(message);
    interpolate(composed.mjml, probe, onError);
    interpolate(composed.subject, probe, onError);

    if (!errors.length) return composed;

    log.warn(
      `Email render error: template=${template} owner=${composed.ownerModel} — ${[...new Set(errors)].join('; ')}`,
      LogScope.email,
    );

    const parent = parentOwner(composed.ownerModel);
    const policy = parent ? composed.onError : 'fail';

    if (policy === 'degrade') return composed;
    if (policy === 'fallback' && parent) {
      composed = await composeTemplate(template, { ...composeCtx(ctx), ownerModel: parent });
      continue;
    }

    throw new EmailRenderError(template, 'render_failed');
  }
};

// Planner job: resolve the audience to recipients-with-context, compose once per context, then
// fan out one deliverEmail per recipient. Per-recipient interpolation/render/send happens in
// deliverEmail so a single bad recipient retries alone and never double-sends.
export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { to, cc: ccAudience, bcc: bccAudience, template, data, sender, tags } = payload;
  const fallbackCtx: ReachContext = sender ?? { ownerModel: 'default' };

  const [toRecipients, ccRecipients, bccRecipients, from] = await Promise.all([
    resolveAudience(to, fallbackCtx),
    ccAudience?.length ? resolveAudience(ccAudience, fallbackCtx) : Promise.resolve<Recipient[]>([]),
    bccAudience?.length ? resolveAudience(bccAudience, fallbackCtx) : Promise.resolve<Recipient[]>([]),
    resolveFromAddress(),
  ]);

  if (!toRecipients.length) return;

  const verified = await verifyAddresses(toRecipients.map((r) => r.user.email));
  const valid = toRecipients.filter((r) => verified.has(r.user.email));
  if (!valid.length) return;

  const adapterName = emailRegistry.names()[0];
  if (!adapterName) {
    log.info(`No email adapter registered — skipping send (template=${template})`);
    return;
  }

  // cc/bcc are recipient roles resolved through the same audience path (context-aware, deduped).
  // They cohere only on a single addressed message — never broadcast across a fan-out — so they
  // ride along only when there's exactly one `to` recipient; a `to` recipient never doubles as cc/bcc.
  const toEmails = new Set(valid.map((r) => r.user.email));
  const ccAddresses = [...new Set(ccRecipients.map((r) => r.user.email))].filter((email) => !toEmails.has(email));
  const bccAddresses = [...new Set(bccRecipients.map((r) => r.user.email))].filter(
    (email) => !toEmails.has(email) && !ccAddresses.includes(email),
  );
  const single = valid.length === 1;
  if (!single && (ccAddresses.length || bccAddresses.length)) {
    log.warn(
      `cc/bcc dropped: only valid on a single-recipient message (template=${template} recipients=${valid.length})`,
      LogScope.email,
    );
  }
  const cc = single && ccAddresses.length ? ccAddresses : undefined;
  const bcc = single && bccAddresses.length ? bccAddresses : undefined;

  const senderData = senderVars();
  const probe: Variables = { sender: senderData, recipient: {}, data };

  // Group recipients by context so each owner's template composes once, not per recipient.
  const groups = new Map<string, { context: ReachContext; recipients: Recipient[] }>();
  for (const r of valid) {
    const key = contextKey(r.context);
    const group = groups.get(key);
    if (group) group.recipients.push(r);
    else groups.set(key, { context: r.context, recipients: [r] });
  }

  let fanned = 0;
  for (const { context, recipients: members } of groups.values()) {
    const composed = await settleTemplate(template, context, probe);

    for (const r of members) {
      const variables: Variables = {
        sender: senderData,
        recipient: { name: r.user.name, email: r.user.email },
        data,
      };

      await enqueueJob(
        'deliverEmail',
        {
          adapterName,
          to: r.user.email,
          cc,
          bcc,
          from,
          subjectTemplate: composed.subject,
          mjmlTemplate: composed.mjml,
          variables,
          tags,
        },
        { id: `${ctx.job.id}:${contextKey(r.context)}:${r.user.email}` },
      );
      fanned += 1;
    }
  }

  log.info(`Email fanned out: template=${template} jobs=${fanned}`, LogScope.email);
});
