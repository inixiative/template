import * as z from 'zod';

export const OrganizationSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().nullish(),
  name: z.string(),
  slug: z.string(),
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;
