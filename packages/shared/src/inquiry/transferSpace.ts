/**
 * @atlas
 * @kind schema
 * @partOf feature:inquiry
 * @uses none
 */
import { z } from 'zod';

export const transferSpaceContentSchema = z.object({});

export type TransferSpaceContent = z.infer<typeof transferSpaceContentSchema>;
