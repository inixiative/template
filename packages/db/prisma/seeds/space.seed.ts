import type { SeedFile } from '../seed';

/**
 * Prime development space.
 */
export const spaceSeeds: SeedFile = {
  model: 'space',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000041',
      organizationId: '01936d42-8c4a-7000-8000-000000000021',
      name: 'Main Space',
      slug: 'main',
      prime: true,
    },
  ],
};
