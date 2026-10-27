/**
 * @atlas
 * @kind validator
 * @partOf primitive:authz
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { type AccessorName, fetchOne, hydrate, ownerColumns } from '@template/db';
import type { EntitlementEntry, Permix } from '@template/permissions';
import { canGrantEntitlement } from '@template/permissions/rebac';
import { makeError } from '#/lib/errors';

const modelOf = (resource: string) => resource.slice('db:'.length) as AccessorName;

const exactKeys = new Set(['field', 'operator', 'value']);

const pinned = (where: Condition | undefined): Record<string, unknown> => {
  if (!where || typeof where !== 'object') return {};
  if ('all' in where && Array.isArray(where.all) && Object.keys(where).length === 1)
    return Object.assign({}, ...where.all.map(pinned));
  const leaf = where as Record<string, unknown>;
  const exact =
    leaf.operator === 'equals' &&
    typeof leaf.field === 'string' &&
    !leaf.field.includes('.') &&
    'value' in leaf &&
    Object.keys(leaf).every((key) => exactKeys.has(key));
  return exact ? { [leaf.field as string]: leaf.value } : {};
};

const anchorRecord = async ({ resource, id }: EntitlementEntry['anchor']) => {
  const model = modelOf(resource);
  const row = await fetchOne<{ id: string }>(model, id);
  return row ? hydrate(model, row) : null;
};

const placedRecord = async (entry: EntitlementEntry) => {
  const anchor = await anchorRecord(entry.anchor);
  if (!anchor)
    throw makeError({
      status: 422,
      message: `No ${entry.anchor.resource} ${entry.anchor.id} to grant from`,
    });
  const model = modelOf(entry.resource);
  const anchorModel = modelOf(entry.anchor.resource);
  if (model === anchorModel) return anchor;
  const placement = ownerColumns(model, anchorModel, anchor);
  if (!placement)
    throw makeError({
      status: 422,
      message: `${entry.resource} is not under ${entry.anchor.resource}: anchor on its tree`,
    });
  return hydrate(model, { ...pinned(entry.where), ...placement, id: '' });
};

export const validateEntitlementGrants = async (
  writer: Permix,
  entries: EntitlementEntry[],
): Promise<void> => {
  for (const entry of entries)
    if (!canGrantEntitlement(writer, entry, await placedRecord(entry)))
      throw makeError({ status: 403, message: 'A delegate holds your permissions or less' });
};
