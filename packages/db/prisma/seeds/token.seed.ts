import { createHash } from 'crypto';
import type { SeedFile } from '../seed';

/**
 * Prime development API tokens.
 *
 * Predictable tokens for local development:
 * - User token:  local_user_owner_personal
 * - Org token:   local_orgUser_acme_main
 * - Space token: local_spaceUser_acme_main
 */

// Helper to generate keyHash and keyPrefix from raw token
const generateTokenFields = (rawToken: string) => {
  const keyHash = createHash('sha256').update(rawToken).digest('hex');
  const keyPrefix = rawToken.slice(0, 20); // First 20 chars as prefix
  return { keyHash, keyPrefix };
};

// Predictable local development tokens
const USER_TOKEN = 'local_user_owner_personal';
const ORG_TOKEN = 'local_orgUser_acme_main';
const SPACE_TOKEN = 'local_spaceUser_acme_main';

export const tokenSeeds: SeedFile = {
  model: 'token',
  updateOmitFields: ['createdAt'],
  records: [
    {
      id: '01936d42-8c4a-7000-8000-000000000061',
      name: 'Owner Personal Token',
      ...generateTokenFields(USER_TOKEN),

      // Polymorphic ownership - personal token
      ownerModel: 'User',
      userId: '01936d42-8c4a-7000-8000-000000000002',
      organizationId: null,
      spaceId: null,

      role: 'member', // Default role
      expiresAt: null, // Never expires
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-000000000062',
      name: 'Organization Token',
      ...generateTokenFields(ORG_TOKEN),

      // Polymorphic ownership - org token
      ownerModel: 'OrganizationUser',
      userId: '01936d42-8c4a-7000-8000-000000000002',
      organizationId: '01936d42-8c4a-7000-8000-000000000021',
      spaceId: null,

      role: 'owner', // Org owner role
      expiresAt: null,
      prime: true,
    },
    {
      id: '01936d42-8c4a-7000-8000-000000000063',
      name: 'Space Token',
      ...generateTokenFields(SPACE_TOKEN),

      // Polymorphic ownership - space token
      ownerModel: 'SpaceUser',
      userId: '01936d42-8c4a-7000-8000-000000000002',
      organizationId: '01936d42-8c4a-7000-8000-000000000021', // Space belongs to org
      spaceId: '01936d42-8c4a-7000-8000-000000000041',

      role: 'owner', // Space owner role
      expiresAt: null,
      prime: true,
    },
  ],
};
