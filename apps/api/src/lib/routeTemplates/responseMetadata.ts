import { z } from 'zod';

export const ResponseMetadataSchema = z.object({
  pagination: z
    .object({
      page: z.number().optional(),
      pageSize: z.number().optional(),
      total: z.number(),
      totalPages: z.number().optional(),
    })
    .optional(),
});

export type ResponseMetadata = z.infer<typeof ResponseMetadataSchema>;
