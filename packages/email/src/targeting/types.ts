export type EmailTarget =
  | { userIds: string[] }
  | { raw: string[] }
  | { orgRole: { organizationId: string; role: string } }
  | { spaceRole: { spaceId: string; role: string } };

export type ResolvedRecipient = {
  to: string;
  name: string;
};
