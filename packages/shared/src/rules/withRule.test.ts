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
const tagRef = [{ model: 'Tag', id: 'tag-1' }];
const arms = { degraded: (issues: ReturnType<typeof ruleIssues>) => issues.map((i) => i.kind), sound: () => ['sound'] };

describe('withRule', () => {
  it('runs the sound arm when the lens admits the rule and every named row is live', () => {
    const live = new Set([referenceKey({ model: 'Tag', id: 'tag-1' })]);
    expect(withRule({ lens, rule: tagged, references: tagRef, live }, arms)).toEqual(['sound']);
  });

  it('a named row outside the live set is a reference issue — absence is the answer', () => {
    expect(withRule({ lens, rule: tagged, references: tagRef, live: new Set() }, arms)).toEqual(['reference']);
  });

  it('no live set means nothing was confirmed, so every named row is a reference issue', () => {
    expect(withRule({ lens, rule: tagged, references: tagRef }, arms)).toEqual(['reference']);
  });

  it('a rule with no references and no live set is sound — there is nothing to confirm', () => {
    const plain: Condition = { field: 'tier', operator: 'equals', value: 'gold' };
    expect(withRule({ lens, rule: plain, references: [] }, arms)).toEqual(['sound']);
  });

  it('a required binding the caller did not supply is a binding issue', () => {
    const bound: Condition = { field: 'tier', operator: 'equals', bind: 'tier' };
    expect(withRule({ lens, rule: bound, references: [] }, arms)).toEqual(['binding']);
    expect(withRule({ lens, rule: bound, references: [], bindings: {} }, arms)).toEqual(['binding']);
    const issues = ruleIssues({ lens, rule: bound, references: [] });
    expect(issues[0]).toMatchObject({ kind: 'binding', name: 'tier' });
  });

  it('a supplied binding is sound, null included — presence is the contract', () => {
    const bound: Condition = { field: 'tier', operator: 'equals', bind: 'tier' };
    expect(withRule({ lens, rule: bound, references: [], bindings: { tier: 'gold' } }, arms)).toEqual(['sound']);
    expect(withRule({ lens, rule: bound, references: [], bindings: { tier: null } }, arms)).toEqual(['sound']);
  });

  it('a rule the lens no longer admits is degraded at evaluation, not only at save', () => {
    const drifted: Condition = { field: 'retiredColumn', operator: 'equals', value: 'x' };
    const issues = ruleIssues({ lens, rule: drifted, references: [] });
    expect(issues.map((issue) => issue.kind)).toEqual(['vocabulary']);
    expect(issues[0]?.detail).toContain('retiredColumn');
  });

  it('reports every issue, not the first — the degraded arm gets the whole picture', () => {
    const drifted: Condition = {
      all: [
        { field: 'retiredColumn', operator: 'equals', value: 'x' },
        { field: 'tier', operator: 'equals', bind: 'tier' },
        tagged,
      ],
    };
    const issues = ruleIssues({ lens, rule: drifted, references: tagRef });
    expect(issues.map((issue) => issue.kind)).toEqual(['binding', 'vocabulary', 'reference']);
  });
});
