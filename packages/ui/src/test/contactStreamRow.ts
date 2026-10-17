import { buildContact } from '@template/db/test';
import type { OrganizationContactsStream } from '@template/ui/hooks/useOrganizationContactsStream';

export type ContactStreamRow = OrganizationContactsStream['data'][number];

export const contactStreamRow = async (
  overrides: { id?: string; organizationId?: string } = {},
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
  });
  return { ...entity.__serialize(), permissionRules: null };
};
