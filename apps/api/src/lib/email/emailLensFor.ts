/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import { rootLens } from '@template/db/lens';
import type { ModelName } from '@template/db/utils/modelNames';
import { emailOwnerProvider, type OwnerScope } from '@template/email/render';
import { lookupAtOwner } from '@template/email/render/lookup';
import {
  type EmailLens,
  type EmailLensInput,
  type EmailSlotLenses,
  emailLens,
  parseSlotLenses,
  scopeEmailLens,
} from '@template/email/rules';
import { type EmailEntry, registry } from '#/lib/email/registry';

const entryData = (entry: EmailEntry): EmailLensInput['data'] =>
  entry.data
    ? { kind: 'fields', fields: Object.fromEntries(entry.data.map((name) => [name, 'String'])) }
    : { kind: 'model', model: rootLens(entry.entity).model as ModelName };

export const projectionForEntry = (entry: EmailEntry | undefined, slots: EmailSlotLenses): EmailLensInput => {
  const chosen = slots.data?.model;
  const data = chosen ? { kind: 'model' as const, model: chosen } : entry ? entryData(entry) : undefined;
  if (!entry) return { data };
  const senderModel = entry.sender.type === 'platform' || entry.sender.type === 'admin' ? null : entry.sender.type;
  return { senderModel, data };
};

export const declaredEmailLens = (slug: string, stored: unknown): EmailLens => {
  const slots = parseSlotLenses(stored);
  return emailLens({ ...projectionForEntry(registry[slug], slots), slots });
};

export const emailLensFor = async (slug: string, owner: OwnerScope, lensOverride?: unknown): Promise<EmailLens> => {
  const stored =
    lensOverride === undefined
      ? (await lookupAtOwner(slug, [], { ownerModel: 'default', locale: owner.locale })).template?.lens
      : lensOverride;
  return scopeEmailLens(declaredEmailLens(slug, stored), emailOwnerProvider(owner));
};
