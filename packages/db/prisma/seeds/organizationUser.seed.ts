import type { OrganizationUser } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

/**
 * Prime organization user relationships.
 */
export const organizationUserSeeds: SeedFile<OrganizationUser> = {
  model: 'organizationUser',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000031',
      userId: '01936d42-8c4a-7000-8000-000000000002',
      organizationId: '01936d42-8c4a-7000-8000-000000000021',
      role: 'owner',
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-000000000032',
      userId: '01936d42-8c4a-7000-8000-000000000003',
      organizationId: '01936d42-8c4a-7000-8000-000000000021',
      role: 'member',
      prime: true,
    },
  ],
};
