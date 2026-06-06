import { FieldKind } from '@inixiative/json-rules';
import { operatorsForFieldKind } from '@template/shared/bracketQuery';
import { describe, expect, it } from 'bun:test';

describe('operatorsForFieldKind', () => {
  it('Int kind includes the comparison operators and excludes string-only ones', () => {
    const ops = operatorsForFieldKind(FieldKind.Int);
    expect(ops).toContain('gte');
    expect(ops).toContain('lte');
    expect(ops).toContain('gt');
    expect(ops).toContain('lt');
    expect(ops).toContain('in');
    expect(ops).toContain('notIn');
    expect(ops).not.toContain('contains');
    expect(ops).not.toContain('startsWith');
  });

  it('String kind includes contains/startsWith/endsWith', () => {
    const ops = operatorsForFieldKind(FieldKind.String);
    expect(ops).toContain('contains');
    expect(ops).toContain('startsWith');
    expect(ops).toContain('endsWith');
    expect(ops).toContain('equals');
  });

  it('maps json-rules names to bracket operator names', () => {
    const ops = operatorsForFieldKind(FieldKind.Int);
    // greaterThanEquals → gte, notEquals → not — json-rules names never leak through
    expect(ops).not.toContain('greaterThanEquals');
    expect(ops).not.toContain('notEquals');
    expect(ops).toContain('not');
  });

  it('drops json-rules operators with no bracket equivalent (between, exists, matches)', () => {
    const ops = operatorsForFieldKind(FieldKind.String);
    expect(ops).not.toContain('between');
    expect(ops).not.toContain('exists');
    expect(ops).not.toContain('matches');
    expect(ops).not.toContain('isEmpty');
  });
});
