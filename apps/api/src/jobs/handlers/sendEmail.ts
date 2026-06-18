/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email
 */
import { db } from '@template/db';
import { fetchLens } from '@template/db/hydrate';
import { prune } from '@template/db/lens';
import { log } from '@template/shared/logger';
import { enqueueJob } from '#/jobs/enqueue';
import { makeJob } from '#/jobs/makeJob';
import { contextKey, emailRegistry } from '#/lib/email';
import { registry } from '#/lib/email/registry';

export type SendEmailPayload = {
  template: string;
  data: Record<string, unknown>;
  tags: string[];
};

type Recipient = { id: string; name: string; email: string };

export const sendEmail = makeJob<SendEmailPayload>(async (ctx, payload) => {
  const { template, data, tags } = payload;

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

  let fanned = 0;
  for (const sender of entry.senders(source)) {
    const recipientLens = entry.recipients(source, sender);
    const users = await fetchLens(db, recipientLens);

    for (const user of users) {
      const recipient = prune(user, recipientLens) as Recipient;
      await enqueueJob(
        'deliverEmail',
        { adapterName, template, sender, data: dataVars, recipient, tags },
        { id: `${ctx.job.id}:${contextKey(sender)}:${recipient.email}` },
      );
      fanned += 1;
    }
  }

  log.info(`Email fanned out: template=${template} jobs=${fanned}`);
});
