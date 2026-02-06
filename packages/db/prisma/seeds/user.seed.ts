import type { SeedFile } from '../seed';

/**
 * Prime development users - the foundation of the dev environment.
 * All marked with prime: true (only seed with --prime flag).
 *
 * Credentials (all use password: "asd123!"):
 * - super@inixiative.com (Platform Superadmin)
 * - owner@inixiative.com (Org/Space Owner)
 * - customer@inixiative.com (End User/Customer)
 *
 * Passwords are automatically seeded via account.seed.ts
 */
export const userSeeds: SeedFile = {
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
