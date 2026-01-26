import type { SeedFile } from '../seed';

/**
 * Test users for development and testing.
 * All marked with testData: true so they're skipped in production.
 */
export const userSeeds: SeedFile = {
  model: 'User',
  records: [
    {
      id: 'test-user-1',
      email: 'test@example.com',
      name: 'Test User',
      emailVerified: true,
      testData: true,
    },
    {
      id: 'admin-user-1',
      email: 'admin@example.com',
      name: 'Admin User',
      emailVerified: true,
      testData: true,
    },
    {
      id: 'unverified-user-1',
      email: 'unverified@example.com',
      name: 'Unverified User',
      emailVerified: false,
      testData: true,
    },
  ],
};
