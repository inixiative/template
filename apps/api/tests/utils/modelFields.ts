import type { EnumField, RelationField, ScalarField, ScalarType } from '@inixiative/field-map';

export const scalarField = (type: ScalarType, isList = false): ScalarField => ({
  kind: 'scalar',
  type,
  isRequired: true,
  isList,
  isId: false,
});

export const enumField = (type: string, values: string[]): EnumField => ({
  kind: 'enum',
  type,
  isRequired: true,
  isList: false,
  values,
});

export const relationField = (type: string): RelationField => ({
  kind: 'object',
  type,
  isRequired: true,
  isList: false,
  fromFields: [],
  toFields: [],
});
