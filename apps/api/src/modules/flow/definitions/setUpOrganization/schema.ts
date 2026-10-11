/**
 * @atlas
 * @kind schema
 * @partOf primitive:flows
 * @uses none
 */
import { uuidV7Schema } from '@template/shared/utils';
import { z } from 'zod';

export const paramsSchema = z.object({
  organizationId: uuidV7Schema,
});

export type SetUpOrganizationParams = z.infer<typeof paramsSchema>;
