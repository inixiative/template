import type { SeedFile } from '../seed';
import { accountSeeds } from './account.seed';
import { organizationSeeds } from './organization.seed';
import { organizationUserSeeds } from './organizationUser.seed';
import { spaceSeeds } from './space.seed';
import { spaceUserSeeds } from './spaceUser.seed';
import { tokenSeeds } from './token.seed';
import { userSeeds } from './user.seed';

const seeds: SeedFile[] = [
  // Order matters for FK constraints
  userSeeds, // 1. Users first (no dependencies)
  accountSeeds, // 2. Accounts with passwords (depends on users)
  organizationSeeds, // 3. Organizations (no dependencies)
  organizationUserSeeds, // 4. Org users (depends on users + orgs)
  spaceSeeds, // 5. Spaces (depends on orgs)
  spaceUserSeeds, // 6. Space users (depends on users + spaces)
  tokenSeeds, // 7. Tokens (depends on users, orgs, spaces)
];

export { seeds };
