import { DbAction, HookTiming, registerDbHook } from './mutationLifeCycle';

/**
 * Webhook action types (maps to WebhookEventAction enum)
 */
export enum WebhookAction {
  create = 'create',
  update = 'update',
  delete = 'delete',
}

/**
 * Models that can trigger webhooks.
 * Must match WebhookModel enum in schema.
 */
const WEBHOOK_ENABLED_MODELS = [
  'User',
  'Pool',
  'Investment',
  'Phase',
  'Event',
  'Payout',
  'GovernanceProposal',
  'Trade',
];

export type WebhookPayload = {
  model: string;
  action: WebhookAction;
  resourceId: string;
  data: any;
  previousData?: any;
  timestamp: string;
};

export type WebhookDeliveryFn = (payload: WebhookPayload) => Promise<void>;

/**
 * Webhook delivery hook.
 *
 * After mutations on webhook-enabled models, checks for subscriptions
 * and queues delivery jobs.
 *
 * @param deliverWebhookFn - Function to queue webhook delivery (injected to avoid circular deps)
 */
export function registerWebhookHook(deliverWebhookFn: WebhookDeliveryFn) {
  const actions = [DbAction.create, DbAction.update, DbAction.delete, DbAction.upsert];

  registerDbHook(
    'webhookDelivery',
    '*', // All models - we filter inside
    HookTiming.after,
    actions,
    async ({ model, action: dbAction, result }) => {
      // Only process webhook-enabled models
      if (!WEBHOOK_ENABLED_MODELS.includes(model)) return;

      // Convert DbAction to WebhookAction
      let webhookAction: WebhookAction;
      if (dbAction === DbAction.upsert) {
        // For upsert, we treat it as an update (could check if record existed before)
        webhookAction = WebhookAction.update;
      } else {
        webhookAction = dbAction as unknown as WebhookAction;
      }

      const resultData = result as { id: string };
      const payload: WebhookPayload = {
        model,
        action: webhookAction,
        resourceId: resultData.id,
        data: result,
        timestamp: new Date().toISOString(),
      };

      await deliverWebhookFn(payload);
    },
  );
}
