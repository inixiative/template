import * as z from 'zod';
import { PlatformRoleSchema } from '../enums/PlatformRole.schema';

export const UserSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullish(),
  email: z.string(),
  emailVerified: z.boolean(),
  name: z.string().nullish(),
  image: z.string().nullish(),
  platformRole: PlatformRoleSchema.default("user"),
});

export type UserType = z.infer<typeof UserSchema>;
