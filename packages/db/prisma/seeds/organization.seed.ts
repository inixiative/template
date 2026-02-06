import type { SeedFile } from '../seed';

/**
 * Prime development organization.
 */
export const organizationSeeds: SeedFile = {
  model: 'organization',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000021',
      name: 'Acme Corporation',
      slug: 'acme',
      prime: true,
    },
  ],
};
