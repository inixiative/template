import type { Prisma } from '@template/db/generated/client/client';

export type ModelName = Prisma.ModelName;

export type CheckConstraint = {
  table: string;
  field: string;
  condition?: string;
};

export type UniqueWhereNotNull = {
  table: string;
  fields: string[];
};

export type PolymorphicRule = {
  type: ModelName;
  required: string[];
};

export type PolymorphicConstraint = {
  typeColumn: string;
  rules: PolymorphicRule[];
};

export type TableConstraints = {
  model: ModelName;
  constraints: PolymorphicConstraint[];
};
