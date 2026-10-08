import type { SeedFile } from '../seed';
import { accountSeeds } from './account.seed';
import { contactSeeds } from './contact.seed';
import { cronJobSeeds } from './cronJob.seed';
import { emailComponentSeeds } from './emailComponent.seed';
import { emailTemplateSeeds } from './emailTemplate.seed';
import { organizationSeeds } from './organization.seed';
import { organizationUserSeeds } from './organizationUser.seed';
import { spaceSeeds } from './space.seed';
import { spaceUserSeeds } from './spaceUser.seed';
import { tokenSeeds } from './token.seed';
import { userSeeds } from './user.seed';

const seeds: SeedFile[] = [
  // Order matters for FK constraints
  userSeeds, // 1. Users first (no dependencies)
  contactSeeds, // 2. Contacts (depends on users) — prime email contacts so seeded users are deliverable
  accountSeeds, // 3. Accounts with passwords (depends on users)
  organizationSeeds, // 3. Organizations (no dependencies)
  organizationUserSeeds, // 4. Org users (depends on users + orgs)
  spaceSeeds, // 5. Spaces (depends on orgs)
  spaceUserSeeds, // 6. Space users (depends on users + spaces)
  tokenSeeds, // 7. Tokens (depends on users, orgs, spaces)
  cronJobSeeds, // 8. Cron jobs (registerCronJobs reads from DB on startup)
  emailComponentSeeds, // 9. Email components (saved by the app; a refused one fails the run last)
  emailTemplateSeeds, // 10. Email templates (references components by slug, not FK)
];

export { seeds };
