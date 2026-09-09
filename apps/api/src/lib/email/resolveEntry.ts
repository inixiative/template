/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import {
  type Condition,
  type LensNarrowing,
  type RuleValue,
  resolveBindings,
  resolveLensBindings,
} from '@inixiative/json-rules';
import { get, isNil } from 'lodash-es';
import {
  type BindSources,
  type EmailEntry,
  type RecipientSpec,
  recipientLens,
  type SenderSpec,
} from '#/lib/email/registry';
import type { Sender } from '#/lib/email/sender';

// Fill a bind-name → value map by reading each declared path from the resolution context.
export class UnresolvedBindError extends Error {
  constructor(
    readonly bind: string,
    readonly path: string,
  ) {
    super(`Email bind "${bind}" resolved to nothing at "${path}"`);
    this.name = 'UnresolvedBindError';
  }
}

const fill = (sources: BindSources, context: Record<string, unknown>): Record<string, RuleValue> =>
  Object.fromEntries(
    Object.entries(sources).map(([name, path]) => {
      const value = get(context, path);
      if (isNil(value)) throw new UnresolvedBindError(name, path);
      return [name, value as RuleValue];
    }),
  );

export const resolveEntity = (entry: EmailEntry, handoff: Record<string, unknown>): LensNarrowing =>
  resolveLensBindings(entry.entity.narrowing, fill(entry.entity.bindings, { data: handoff })) as LensNarrowing;

export const resolveSenderIdentity = (spec: SenderSpec, entity: Record<string, unknown>): Sender => {
  if (spec.type === 'platform' || spec.type === 'admin') return { type: spec.type };
  return { type: spec.type, ...fill(spec.bindings, { entity }) } as Sender;
};

export const resolveRecipients = (
  spec: RecipientSpec,
  entity: Record<string, unknown>,
  sender: Sender,
): LensNarrowing =>
  recipientLens(spec, resolveBindings(spec.where, fill(spec.bindings, { entity, sender })) as Condition);

export const resolveData = (
  entry: EmailEntry,
  entity: Record<string, unknown>,
  handoff: Record<string, unknown>,
): Record<string, unknown> | undefined => (entry.data ? fill(entry.data, { entity, handoff }) : undefined);
