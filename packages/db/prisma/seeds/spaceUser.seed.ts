/**
 * @atlas
 * @kind seed
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { SpaceUser } from '../../src/generated/client/client';
import type { SeedFile } from '../seed';

export const spaceUserSeeds: SeedFile<SpaceUser> = {
  model: 'spaceUser',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000051',
      userId: '01936d42-8c4a-7000-8000-000000000002',
      organizationId: '01936d42-8c4a-7000-8000-000000000021',
      spaceId: '01936d42-8c4a-7000-8000-000000000041',
      role: 'owner',
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-000000000052',
      userId: '01936d42-8c4a-7000-8000-000000000003',
      organizationId: '01936d42-8c4a-7000-8000-000000000021',
      spaceId: '01936d42-8c4a-7000-8000-000000000041',
      role: 'member',
      prime: true,
    },
  ],
};
