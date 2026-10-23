/**
 * @atlas
 * @kind helper
 * @partOf feature:webhooks
 */
import {
  db,
  POLYMORPHIC_BINDS,
  type PolymorphicKind,
  polymorphicKeyColumn,
  polymorphicTarget,
} from '@template/db';
import type { WebhookModel, WebhookSubscription } from '@template/db/generated/client/client';
import { uniq } from 'lodash-es';
import type { Party } from '#/hooks/webhooks/parties';

const ownerKinds = Object.keys(POLYMORPHIC_BINDS) as PolymorphicKind[];

export const findPartySubscriptions = (model: WebhookModel, parties: Party[]) =>
  db.webhookSubscription.findMany({
    where: {
      model,
      isActive: true,
      OR: ownerKinds.map((kind) => ({
        ownerModel: kind,
        [polymorphicKeyColumn('WebhookSubscription', 'ownerModel', kind) as string]: {
          in: uniq(parties.filter((party) => party.kind === kind).map((party) => party.id)),
        },
      })),
    },
  });

export const isPartyTo = (subscription: WebhookSubscription, parties: Party[]) => {
  const owner = polymorphicTarget(subscription, 'WebhookSubscription', 'ownerModel');
  return !!owner && parties.some((party) => party.kind === owner.kind && party.id === owner.id);
};
