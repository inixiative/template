import type { Role } from '@template/db/generated/client/enums';

export type EmailTarget =
  | { userIds: string[] }
  | { raw: string[] }
  | { orgRole: { organizationId: string; role: Role } }
  | { spaceRole: { spaceId: string; role: Role } };

export type ResolvedRecipient = {
  to: string;
  name: string;
};
