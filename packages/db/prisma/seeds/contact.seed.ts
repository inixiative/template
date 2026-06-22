/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:seed
 * @uses none
 */
import type { Contact } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

// Seeds bypass the mutation hooks, so `valueKey` (normally derived by contactRules) is set explicitly.
// Without these, prime users have no email Contact and non-system mail to them is suppressed.
export const contactSeeds: SeedFile<Contact> = {
  model: 'contact',
  records: [
    {
      id: '01936d42-8c4a-7000-8000-0000000000c1',
      ownerModel: 'User',
      userId: '01936d42-8c4a-7000-8000-000000000001',
      type: 'email',
      value: { address: 'super@inixiative.com' },
      valueKey: 'super@inixiative.com',
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-0000000000c2',
      ownerModel: 'User',
      userId: '01936d42-8c4a-7000-8000-000000000002',
      type: 'email',
      value: { address: 'owner@inixiative.com' },
      valueKey: 'owner@inixiative.com',
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-0000000000c3',
      ownerModel: 'User',
      userId: '01936d42-8c4a-7000-8000-000000000003',
      type: 'email',
      value: { address: 'customer@inixiative.com' },
      valueKey: 'customer@inixiative.com',
      prime: true,
    },
  ],
};
