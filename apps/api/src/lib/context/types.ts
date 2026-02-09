import type {
  Organization,
  OrganizationUser,
  Space,
  SpaceUser,
  Token,
  User,
} from '@template/db/generated/client/client';

export type TokenWithRelations = Token & {
  user: User | null;
  organization: Organization | null;
  organizationUser: (OrganizationUser & { organization: Organization; user: User }) | null;
  space: Space | null;
  spaceUser:
    | (SpaceUser & { organization: Organization; organizationUser: OrganizationUser; space: Space; user: User })
    | null;
};
