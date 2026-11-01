/**
 * @atlas
 * @kind schema
 * @partOf feature:project
 */
import { ProjectScalarInputSchema, ProjectScalarSchema } from '@template/db';

export const PROJECT_IMMUTABLE_FIELDS = [
  'ownerModel',
  'userId',
  'organizationId',
  'spaceId',
] as const;

export const projectCreateBodySchema = ProjectScalarInputSchema.omit({
  ownerModel: true,
  userId: true,
  organizationId: true,
  spaceId: true,
});

export const projectUpdateBodySchema = projectCreateBodySchema.partial();

export const projectReadResponseSchema = ProjectScalarSchema;
