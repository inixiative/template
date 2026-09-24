import { organizationContactsStream } from '@template/db/streams';
import { buildContact } from '@template/db/test';
import type { StreamActionPayload } from '@template/shared/ws';

export type ContactStreamRow = StreamActionPayload<typeof organizationContactsStream, 'upsert'>;

export const contactStreamRow = async (
  overrides: { id?: string; updatedAt?: string; organizationId?: string } = {},
): Promise<ContactStreamRow> => {
  const { entity } = await buildContact({
    ownerModel: 'Organization',
    organizationId: overrides.organizationId ?? 'org-1',
    userId: null,
    spaceId: null,
    subtype: null,
    label: null,
    position: 0,
    valueKey: null,
    verifiedAt: null,
    source: null,
    deliverability: null,
    deliverabilityCheckedAt: null,
    acceptedKinds: [],
    ...(overrides.id ? { id: overrides.id } : {}),
    ...(overrides.updatedAt ? { updatedAt: new Date(overrides.updatedAt) } : {}),
  });
  return organizationContactsStream.actions.upsert.parse({ ...entity.__serialize(), permissionRules: null });
};
