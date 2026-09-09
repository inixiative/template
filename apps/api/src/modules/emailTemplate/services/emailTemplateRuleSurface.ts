/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */
import type { Lens, SourceValues } from '@inixiative/json-rules';
import { rootLens } from '@template/db/lens';
import type { ModelName } from '@template/db/utils/modelNames';
import { lookupAtOwner } from '@template/email/render/lookup';
import {
  type EmailProjectionInput,
  type EmailRuleDecoration,
  type EmailSlotLenses,
  emailProjection,
  emailRuleDecoration,
  emailSurface,
  parseSlotLenses,
} from '@template/email/rules';
import { type EmailEntry, registry } from '#/lib/email/registry';

export type EmailTemplateRuleSurface = { source: Lens; sourceValues: SourceValues[]; decoration: EmailRuleDecoration };

const entryData = (entry: EmailEntry): EmailProjectionInput['data'] =>
  entry.data
    ? { kind: 'fields', fields: Object.fromEntries(Object.keys(entry.data).map((name) => [name, 'String'])) }
    : { kind: 'model', model: rootLens(entry.entity.narrowing).model as ModelName };

export const projectionForEntry = (entry: EmailEntry | undefined, slots: EmailSlotLenses): EmailProjectionInput => {
  const chosen = slots.data?.model;
  const data = chosen ? { kind: 'model' as const, model: chosen } : entry ? entryData(entry) : undefined;
  if (!entry) return { data };
  const senderModel = entry.sender.type === 'platform' || entry.sender.type === 'admin' ? null : entry.sender.type;
  return { senderModel, data };
};

export const emailTemplateRuleSurface = async (slug: string, locale = 'en'): Promise<EmailTemplateRuleSurface> => {
  const { template } = await lookupAtOwner(slug, [], { ownerModel: 'default', locale });
  const slots = parseSlotLenses(template?.lens);
  const projection = emailProjection(projectionForEntry(registry[slug], slots));
  const source = emailSurface(projection, slots);
  return { source, sourceValues: [], decoration: emailRuleDecoration(source) };
};
