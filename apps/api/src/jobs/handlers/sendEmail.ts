/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import { LogScope, log } from '@template/shared/logger';
import { enqueueJob } from '#/jobs/enqueue';
import { makeJob } from '#/jobs/makeJob';
import { type Audience, contextKey, type ReachContext, resolveAudience, type Recipient } from '#/lib/audience';
import { emailRegistry, emailVerifier } from '#/lib/email';

export type SendEmailPayload = {
  audience: Audience[];
  template: string;
  data: Record<string, unknown>;
  sender?: ReachContext;
  tags: string[];
};

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

const addresses = (recipients: Recipient[], as: Recipient['as'], exclude: Set<string>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of recipients) {
    if (r.as !== as || exclude.has(r.user.email) || seen.has(r.user.email)) continue;
    seen.add(r.user.email);
    out.push(r.user.email);
  }
  return out;
};

// Planner job: resolve the audience to recipients-with-context, then fan out one deliverEmail per
// `to` recipient. Compose/render/send all happen in deliverEmail (keyed off the template name +
// context) so a single bad recipient retries alone and never double-sends.
export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { audience, template, data, sender, tags } = payload;
  const fallbackCtx: ReachContext = sender ?? { ownerModel: 'default' };

  const recipients = await resolveAudience(audience, fallbackCtx);
  const to = recipients.filter((r) => r.as === 'to');
  if (!to.length) return;

  const verified = await verifyAddresses(to.map((r) => r.user.email));
  const valid = to.filter((r) => verified.has(r.user.email));
  if (!valid.length) return;

  const adapterName = emailRegistry.names()[0];
  if (!adapterName) {
    log.info(`No email adapter registered — skipping send (template=${template})`);
    return;
  }

  // cc/bcc are resolved roles that cohere only on a single addressed message — never broadcast
  // across a fan-out. They ride along only when there's exactly one `to`; a `to` never doubles
  // as cc/bcc, and bcc never doubles as cc.
  const toEmails = new Set(valid.map((r) => r.user.email));
  const cc = addresses(recipients, 'cc', toEmails);
  const bcc = addresses(recipients, 'bcc', new Set([...toEmails, ...cc]));
  const single = valid.length === 1;
  if (!single && (cc.length || bcc.length)) {
    log.warn(
      `cc/bcc dropped: only valid on a single-recipient message (template=${template} recipients=${valid.length})`,
      LogScope.email,
    );
  }

  let fanned = 0;
  for (const r of valid) {
    await enqueueJob(
      'deliverEmail',
      {
        adapterName,
        recipient: { name: r.user.name, email: r.user.email },
        cc: single && cc.length ? cc : undefined,
        bcc: single && bcc.length ? bcc : undefined,
        template,
        context: r.context,
        data,
        tags,
      },
      { id: `${ctx.job.id}:${contextKey(r.context)}:${r.user.email}` },
    );
    fanned += 1;
  }

  log.info(`Email fanned out: template=${template} jobs=${fanned}`, LogScope.email);
});
