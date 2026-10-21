import { describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { segmentRouter } from '#/modules/segment';
import { validateSegmentConditions } from '#/modules/segment/validations/validateSegmentConditions';
import { createTestApp } from '#tests/createTestApp';
import { get, json } from '#tests/utils/request';

type SegmentInfo = {
  root: string;
  nodes: { kind: string }[];
  operators: { field: Record<string, string[]>; date: Record<string, string[]>; array: string[] };
  valueShapes: { field: Record<string, string> };
  fields: {
    path: string;
    kind: string;
    isList: boolean;
    values: string[];
    sourced: boolean;
  }[];
};

const { fetch } = createTestApp({
  mount: [(app) => app.route('/api/v1/segment', segmentRouter)],
});

const loadInfo = async () => {
  const response = await fetch(get('/api/v1/segment/info'));
  expect(response.status).toBe(200);
  return (await json<SegmentInfo>(response)).data;
};

describe('GET /api/v1/segment/info', () => {
  it('answers without a session', async () => {
    const info = await loadInfo();
    expect(info.root).toBe('CustomerRef');
  });

  it('lists every node kind and the operators each field kind takes', async () => {
    const info = await loadInfo();
    expect(info.nodes.map((node) => node.kind)).toEqual([
      'all',
      'any',
      'ifThenElse',
      'rule',
      'date',
      'array',
      'aggregate',
      'boolean',
    ]);
    expect(info.operators.field.Enum).toContain(Operator.in);
    expect(info.operators.date.DateTime).toContain('within');
    expect(info.operators.array).toContain('any');
    expect(info.valueShapes.field[Operator.exists]).toBe('none');
  });

  it('lists fields every one of which the save gate accepts', async () => {
    const info = await loadInfo();
    const byPath = new Map(info.fields.map((field) => [field.path, field]));
    expect(byPath.get('customerUser.contacts')).toMatchObject({ kind: 'relation', isList: true });
    expect(byPath.get('segmentMembers.segment.id')?.sourced).toBe(true);
    expect(byPath.get('customerModel')?.values).toEqual(['User', 'Organization', 'Space']);

    const crossesList = (path: string) =>
      path
        .split('.')
        .slice(0, -1)
        .some((_, index, segments) => byPath.get(segments.slice(0, index + 1).join('.'))?.isList);

    const scalars = info.fields.filter(
      (field) => field.kind !== 'relation' && !field.sourced && !crossesList(field.path),
    );
    expect(scalars.length).toBeGreaterThan(5);
    for (const field of scalars) {
      const validation = validateSegmentConditions(
        { field: field.path, operator: Operator.exists },
        'Organization',
      );
      expect({ path: field.path, valid: validation.valid }).toEqual({
        path: field.path,
        valid: true,
      });
    }
  });
});
