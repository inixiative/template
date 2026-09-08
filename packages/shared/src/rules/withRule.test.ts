import { describe, expect, it } from 'bun:test';
import { type Condition, createLens, type FieldMap } from '@inixiative/json-rules';
import { referenceKey, ruleIssues, withRule } from '@template/shared/rules/withRule';

const map: FieldMap = {
  models: {
    User: {
      fields: {
        id: { kind: 'scalar', type: 'String', isRequired: true },
        tier: { kind: 'scalar', type: 'String' },
        tagAttachments: { kind: 'object', type: 'TagAttachment', isList: true },
      },
    },
    TagAttachment: { fields: { tag: { kind: 'object', type: 'Tag' } } },
    Tag: { fields: { id: { kind: 'scalar', type: 'String', isRequired: true } } },
  },
};
const lens = createLens({ maps: { prisma: map }, mapName: 'prisma', model: 'User' });

const tagged: Condition = {
  field: 'tagAttachments',
  arrayOperator: 'any',
  condition: { field: 'tag.id', operator: 'equals', value: 'tag-1' },
};
const tagRef = { references: [{ model: 'Tag', id: 'tag-1' }], dynamic: false };
const arms = { degraded: (issues: ReturnType<typeof ruleIssues>) => issues.map((i) => i.kind), sound: () => ['sound'] };

describe('withRule', () => {
  it('runs the sound arm when the lens admits the rule and every named row is live', () => {
    const live = new Set([referenceKey({ model: 'Tag', id: 'tag-1' })]);
    expect(withRule({ lens, rule: tagged, references: tagRef, live }, arms)).toEqual(['sound']);
  });

  it('a named row outside the live set is missing — absence is the answer', () => {
    expect(withRule({ lens, rule: tagged, references: tagRef, live: new Set() }, arms)).toEqual(['missing']);
  });

  it('no live set means nothing was confirmed, so every named row is missing', () => {
    expect(withRule({ lens, rule: tagged, references: tagRef }, arms)).toEqual(['missing']);
  });

  it('a rule with no references and no live set is sound — there is nothing to confirm', () => {
    const plain: Condition = { field: 'tier', operator: 'equals', value: 'gold' };
    expect(withRule({ lens, rule: plain, references: { references: [], dynamic: false } }, arms)).toEqual(['sound']);
  });

  it('a dynamic reference is degraded even when the live set is full', () => {
    const live = new Set([referenceKey({ model: 'Tag', id: 'tag-1' })]);
    const health = { lens, rule: tagged, references: { ...tagRef, dynamic: true }, live };
    expect(withRule(health, arms)).toEqual(['dynamic']);
  });

  it('a rule the lens no longer admits is degraded at evaluation, not only at save', () => {
    const drifted: Condition = { field: 'retiredColumn', operator: 'equals', value: 'x' };
    const issues = ruleIssues({ lens, rule: drifted, references: { references: [], dynamic: false } });
    expect(issues.map((issue) => issue.kind)).toEqual(['vocabulary']);
    expect(issues[0]?.detail).toContain('retiredColumn');
  });

  it('reports every issue, not the first — the degraded arm gets the whole picture', () => {
    const drifted: Condition = {
      all: [{ field: 'retiredColumn', operator: 'equals', value: 'x' }, tagged],
    };
    const issues = ruleIssues({ lens, rule: drifted, references: { ...tagRef, dynamic: true } });
    expect(issues.map((issue) => issue.kind)).toEqual(['vocabulary', 'dynamic', 'missing']);
  });
});
