/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import type { Prisma } from '@template/db/generated/client/client';
import { EntitlementResourceModel } from '@template/db/generated/client/enums';
import { z } from 'zod';

/** One row a writer grants: actions on a resource, from a source. Its owner is the holder's owner. */
export const entitlementInputSchema = z
  .object({
    resource: z.enum(EntitlementResourceModel),
    actions: z.array(z.string().min(1)),
    where: (
      z.record(z.string(), z.unknown()) as unknown as z.ZodType<Prisma.InputJsonObject>
    ).optional(),
    sourceModel: z.enum(EntitlementResourceModel),
    sourceId: z.string().min(1),
    sourcePath: z.string().min(1).optional(),
  })
  .strict();

export const entitlementInputsSchema = z.array(entitlementInputSchema);
