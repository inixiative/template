/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import type { LensNarrowing } from '@inixiative/json-rules';
import { db } from '@template/db';
import { fetchLens } from '@template/db/hydrate';
import { prune } from '@template/db/lens';
import { log } from '@template/shared/logger';
import { enqueueJob } from '#/jobs/enqueue';
import { makeJob } from '#/jobs/makeJob';
import { contextKey, emailRegistry } from '#/lib/email';
import { deliverJobId } from '#/lib/email/idempotency';
import { registry } from '#/lib/email/registry';

export type SendEmailPayload = {
  eventName: string;
  template: string;
  data: Record<string, unknown>;
  tags: string[];
};

type Recipient = { id: string; name: string; email: string };

export const sendEmail = makeJob<SendEmailPayload>(async (_ctx, payload) => {
  const { eventName, template, data, tags } = payload;

  const entry = registry[template];
  if (!entry) {
    log.info(`No email registry entry — skipping (template=${template})`);
    return;
  }

  const sourceLens = entry.source(data);
  const [source] = await fetchLens(db, sourceLens);
  if (!source) return;

  const adapterName = emailRegistry.names()[0];
  if (!adapterName) {
    log.info(`No email adapter registered — skipping (template=${template})`);
    return;
  }

  const dataVars = entry.data ? entry.data(source, data) : (prune(source, sourceLens) as Record<string, unknown>);

  const emailsOf = async (lens: LensNarrowing): Promise<string[] | undefined> => {
    const rows = await fetchLens(db, lens);
    if (!rows.length) return undefined;
    return (prune(rows, lens) as Array<{ email: string }>).map((r) => r.email);
  };

  let fanned = 0;
  for (const sender of entry.senders(source)) {
    const recipientLens = entry.recipients(source, sender);

    for (const user of await fetchLens(db, recipientLens)) {
      const recipient = prune(user, recipientLens) as Recipient;
      const cc = entry.cc ? await emailsOf(entry.cc(user, sender)) : undefined;
      const bcc = entry.bcc ? await emailsOf(entry.bcc(user, sender)) : undefined;

      await enqueueJob(
        'deliverEmail',
        { adapterName, template, sender, recipient, cc, bcc, data: dataVars, tags },
        { id: deliverJobId(eventName, template, contextKey(sender), recipient.email, dataVars) },
      );
      fanned += 1;
    }
  }

  log.info(`Email fanned out: template=${template} jobs=${fanned}`);
});
