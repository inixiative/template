/**
 * @atlas
 * @kind handler
 * @partOf feature:webhooks
 * @uses infrastructure:prisma
 */
import { DbAction, HookTiming, registerDbHook } from '@template/db';
import { castArray } from 'lodash-es';
import { validateWebhookUrl } from '#/lib/webhooks/validators/validateWebhookUrl';

// SSRF guard on every WebhookSubscription write: reject URLs targeting a private/internal
// address at create/update time (sync policy only — no DNS, no per-write latency).
export const registerWebhookSubscriptionUrlHook = () => {
  registerDbHook(
    'webhookSubscriptionUrl',
    'WebhookSubscription',
    HookTiming.before,
    [DbAction.create, DbAction.createManyAndReturn, DbAction.update, DbAction.updateManyAndReturn, DbAction.upsert],
    async ({ args }) => {
      const { data, create, update } = (args ?? {}) as { data?: unknown; create?: unknown; update?: unknown };
      for (const payload of [data, create, update].flatMap((d) => castArray(d))) {
        const url = (payload as { url?: unknown } | undefined)?.url;
        if (typeof url === 'string') validateWebhookUrl(url);
      }
    },
  );
};
