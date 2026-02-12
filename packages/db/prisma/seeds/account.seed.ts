import { hashSync } from 'bcryptjs';
import type { Account } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

// Password for all prime users: "asd123!"
const PASSWORD = 'asd123!';
const HASHED_PASSWORD = hashSync(PASSWORD, 10);

/**
 * Prime development accounts with passwords.
 * All use password: "asd123!"
 */
export const accountSeeds: SeedFile<Account> = {
  model: 'account',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000011',
      userId: '01936d42-8c4a-7000-8000-000000000001',
      accountId: 'super@inixiative.com',
      providerId: 'credential',
      password: HASHED_PASSWORD,
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-000000000012',
      userId: '01936d42-8c4a-7000-8000-000000000002',
      accountId: 'owner@inixiative.com',
      providerId: 'credential',
      password: HASHED_PASSWORD,
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-000000000013',
      userId: '01936d42-8c4a-7000-8000-000000000003',
      accountId: 'customer@inixiative.com',
      providerId: 'credential',
      password: HASHED_PASSWORD,
      prime: true,
    },
  ],
};
