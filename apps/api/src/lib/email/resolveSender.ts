/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { type Condition, getLensRoot, Operator } from '@inixiative/json-rules';
import type { ModelName } from '@template/db';
import { fetchLens } from '@template/db/hydrate';
import { lensFor } from '@template/db/lens';
import { scalarPicks } from '@template/email/rules';
import type { Sender } from '#/lib/email/sender';

type SenderRow = { model: ModelName; key: Record<string, string> };

const senderRow = (sender: Sender): SenderRow | null => {
  switch (sender.type) {
    case 'User':
      return { model: 'User', key: { id: sender.userId } };
    case 'Organization':
      return { model: 'Organization', key: { id: sender.organizationId } };
    case 'Space':
      return { model: 'Space', key: { id: sender.spaceId } };
    case 'OrganizationUser':
      return {
        model: 'OrganizationUser',
        key: { userId: sender.userId, organizationId: sender.organizationId },
      };
    case 'SpaceUser':
      return { model: 'SpaceUser', key: { userId: sender.userId, spaceId: sender.spaceId } };
    default:
      return null;
  }
};

export const resolveSender = async (
  sender: Sender,
): Promise<Record<string, unknown> | undefined> => {
  const row = senderRow(sender);
  if (!row) return undefined;
  const lens = lensFor(row.model);
  const base = getLensRoot(lens);
  const where: Condition = {
    all: Object.entries(row.key).map(([field, value]) => ({
      field,
      operator: Operator.equals,
      value,
    })),
  };
  const [found] = await fetchLens({
    parent: lens,
    root: { where, ...scalarPicks(base.maps[base.mapName]?.models[base.model]?.fields ?? {}) },
  });
  return found;
};
