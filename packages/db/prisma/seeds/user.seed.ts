/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:prisma
 */
import type { User } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

export const userSeeds: SeedFile<User> = {
  model: 'user',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000001',
      email: 'super@inixiative.com',
      name: 'Super Admin',
      displayName: 'Platform Admin',
      emailVerified: true,
      platformRole: 'superadmin',
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-000000000002',
      email: 'owner@inixiative.com',
      name: 'Organization Owner',
      displayName: 'Org Owner',
      emailVerified: true,
      platformRole: 'user',
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-000000000003',
      email: 'customer@inixiative.com',
      name: 'Test Customer',
      displayName: 'Customer User',
      emailVerified: true,
      platformRole: 'user',
      prime: true,
    },
  ],
};
