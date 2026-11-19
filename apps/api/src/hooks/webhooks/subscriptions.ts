/**
 * @atlas
 * @kind utils
 * @partOf feature:webhooks
 */
import { db, rowPolymorphicAxisPointsAt, wherePolymorphicSideIsOneOf } from '@template/db';
import type { WebhookModel, WebhookSubscription } from '@template/db/generated/client/client';
import type { Party } from '#/hooks/webhooks/parties';

export const findPartySubscriptions = (model: WebhookModel, parties: Party[]) =>
  db.webhookSubscription.findMany({
    where: {
      model,
      isActive: true,
      ...wherePolymorphicSideIsOneOf('WebhookSubscription', 'ownerModel', parties),
    },
  });

export const isPartyTo = (subscription: WebhookSubscription, parties: Party[]) => {
  const owner = rowPolymorphicAxisPointsAt(subscription, 'WebhookSubscription', 'ownerModel');
  return !!owner && parties.some((party) => party.kind === owner.kind && party.id === owner.id);
};
