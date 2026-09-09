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
  emailProjection,
  emailRuleDecoration,
  emailSurface,
  parseSlotLenses,
} from '@template/email/rules';
import { type EmailEntry, registry } from '#/lib/email/registry';

export type EmailTemplateRuleSurface = { source: Lens; sourceValues: SourceValues[]; decoration: EmailRuleDecoration };

export const projectionForEntry = (entry: EmailEntry | undefined): EmailProjectionInput => {
  if (!entry) return {};
  const senderModel = entry.sender.type === 'platform' || entry.sender.type === 'admin' ? null : entry.sender.type;
  const data: EmailProjectionInput['data'] = entry.data
    ? { kind: 'fields', fields: Object.fromEntries(Object.keys(entry.data).map((name) => [name, 'String'])) }
    : { kind: 'model', model: rootLens(entry.entity.narrowing).model as ModelName };
  return { senderModel, data };
};

export const emailTemplateRuleSurface = async (slug: string, locale = 'en'): Promise<EmailTemplateRuleSurface> => {
  const { template } = await lookupAtOwner(slug, [], { ownerModel: 'default', locale });
  const projection = emailProjection(projectionForEntry(registry[slug]));
  const source = emailSurface(projection, parseSlotLenses(template?.lens));
  return { source, sourceValues: [], decoration: emailRuleDecoration(source) };
};
