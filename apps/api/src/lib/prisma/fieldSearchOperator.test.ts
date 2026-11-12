import { describe, expect, it } from 'bun:test';
import { fieldSearchOperator } from '#/lib/prisma/fieldSearchOperator';
import { enumField, relationField, scalarField } from '#tests/utils/modelFields';

describe('fieldSearchOperator', () => {
  it('String scalar → case-insensitive contains', () => {
    expect(fieldSearchOperator(scalarField('String'), 'foo')).toEqual({
      contains: 'foo',
      mode: 'insensitive',
    });
  });

  it('String[] → has (exact element)', () => {
    expect(fieldSearchOperator(scalarField('String', true), 'foo')).toEqual({
      has: 'foo',
    });
  });

  it('Json → string_contains', () => {
    expect(fieldSearchOperator(scalarField('Json'), 'foo')).toEqual({
      string_contains: 'foo',
    });
  });

  it('non-text scalars and relations → undefined (skipped)', () => {
    expect(fieldSearchOperator(scalarField('Int'), 'foo')).toBeUndefined();
    expect(fieldSearchOperator(scalarField('DateTime'), 'foo')).toBeUndefined();
    expect(fieldSearchOperator(enumField('Role', []), 'foo')).toBeUndefined();
    expect(fieldSearchOperator(relationField('User'), 'foo')).toBeUndefined();
  });
});
