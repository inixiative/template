/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { type Condition, type LensNarrowing, resolveBindings, resolveLensBindings, type RuleValue } from '@inixiative/json-rules';
import { get } from 'lodash-es';
import {
  type BindSources,
  type EmailEntry,
  recipientLens,
  type RecipientSpec,
  type SenderSpec,
} from '#/lib/email/registry';
import type { Sender } from '#/lib/email/sender';

// Fill a bind-name → value map by reading each declared path from the resolution context.
const fill = (sources: BindSources, context: Record<string, unknown>): Record<string, RuleValue> =>
  Object.fromEntries(Object.entries(sources).map(([name, path]) => [name, get(context, path) as RuleValue]));

export const resolveEntity = (entry: EmailEntry, handoff: Record<string, unknown>): LensNarrowing =>
  resolveLensBindings(entry.entity.narrowing, fill(entry.entity.bindings, { data: handoff })) as LensNarrowing;

export const resolveSenderIdentity = (spec: SenderSpec, entity: Record<string, unknown>): Sender => {
  // Sender id fields read the same `{ entity }` context (paths like `entity.sourceOrganizationId`)
  // as every other resolver — one path convention throughout.
  const ctx = { entity };
  const at = (path: string): string => get(ctx, path) as string;
  switch (spec.type) {
    case 'platform':
    case 'admin':
      return { type: spec.type };
    case 'User':
      return { type: 'User', userId: at(spec.bindings.userId) };
    case 'Organization':
      return { type: 'Organization', organizationId: at(spec.bindings.organizationId) };
    case 'Space':
      return { type: 'Space', spaceId: at(spec.bindings.spaceId), organizationId: at(spec.bindings.organizationId) };
    case 'OrganizationUser':
      return { type: 'OrganizationUser', userId: at(spec.bindings.userId), organizationId: at(spec.bindings.organizationId) };
    case 'SpaceUser':
      return {
        type: 'SpaceUser',
        userId: at(spec.bindings.userId),
        spaceId: at(spec.bindings.spaceId),
        organizationId: at(spec.bindings.organizationId),
      };
  }
};

export const resolveRecipients = (spec: RecipientSpec, entity: Record<string, unknown>, sender: Sender): LensNarrowing =>
  recipientLens(spec, resolveBindings(spec.where, fill(spec.bindings, { entity, sender })) as Condition);

export const resolveData = (
  entry: EmailEntry,
  entity: Record<string, unknown>,
  handoff: Record<string, unknown>,
): Record<string, unknown> | undefined => (entry.data ? fill(entry.data, { entity, handoff }) : undefined);
