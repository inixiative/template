import * as z from 'zod';
import { OrganizationRoleSchema } from '../enums/OrganizationRole.schema';
import { TokenOwnerModelSchema } from '../enums/TokenOwnerModel.schema';

export const TokenSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  name: z.string(),
  keyHash: z.string(),
  keyPrefix: z.string(),
  ownerModel: TokenOwnerModelSchema,
  userId: z.string().nullish(),
  organizationId: z.string().nullish(),
  role: OrganizationRoleSchema.default("member"),
  entitlements: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").nullish(),
  expiresAt: z.date().nullish(),
  lastUsedAt: z.date().nullish(),
  isActive: z.boolean().default(true),
});

export type TokenType = z.infer<typeof TokenSchema>;
