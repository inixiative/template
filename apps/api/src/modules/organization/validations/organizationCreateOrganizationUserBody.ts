import { z } from '@hono/zod-openapi';

const schema = z
  .object({
    userId: z.string().uuid().optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => data.userId || data.email, {
    message: 'Either userId or email is required',
  });

export const validateOrganizationCreateOrganizationUserBody = (body: unknown) => schema.parse(body);
