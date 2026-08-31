import { describe, expect, it } from 'bun:test';
import type { Condition } from '@inixiative/json-rules';
import { contentRuleReferences, ruleReferences } from '@template/email/rules/ruleReferences';

const block = (rule: unknown, body = 'X') => `{{#if rule=${JSON.stringify(rule)}}}${body}{{/if}}`;

describe('ruleReferences — the rows an email rule names', () => {
  it('a membership rule over recipient tags names each tag', () => {
    const rule: Condition = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'in', value: ['tag-a', 'tag-b'] },
    };
    expect(ruleReferences(rule)).toEqual({
      references: [
        { model: 'Tag', id: 'tag-a' },
        { model: 'Tag', id: 'tag-b' },
      ],
      dynamic: false,
    });
  });

  it('dotted spellings reach the same sources: space and organization membership', () => {
    const rule: Condition = {
      any: [
        { field: 'recipient.spaceUsers.space.id', operator: 'equals', value: 'space-1' },
        { field: 'recipient.organizationUsers.organization.id', operator: 'notEquals', value: 'org-1' },
      ],
    };
    expect(ruleReferences(rule).references).toEqual([
      { model: 'Space', id: 'space-1' },
      { model: 'Organization', id: 'org-1' },
    ]);
  });

  it('vocabulary values, plain recipient fields, sender and data name no rows', () => {
    const rule: Condition = {
      all: [
        { field: 'recipient.tagAttachments.tag.name', operator: 'equals', value: 'vip' },
        { field: 'recipient.name', operator: 'equals', value: 'tag-a' },
        { field: 'sender.id', operator: 'equals', value: 'tag-a' },
        { field: 'data.tagId', operator: 'equals', value: 'tag-a' },
      ],
    };
    expect(ruleReferences(rule)).toEqual({ references: [], dynamic: false });
  });

  it('a row read from path is dynamic, not a reference', () => {
    const rule: Condition = { field: 'recipient.tagAttachments.tag.id', operator: 'equals', path: 'data.tagId' };
    expect(ruleReferences(rule)).toEqual({ references: [], dynamic: true });
  });

  it('contentRuleReferences folds every block, branch and nesting across contents, deduped', () => {
    const tagA: Condition = { field: 'recipient.tagAttachments.tag.id', operator: 'equals', value: 'tag-a' };
    const tagB: Condition = { field: 'recipient.tagAttachments.tag.id', operator: 'equals', value: 'tag-b' };
    const space: Condition = { field: 'recipient.spaceUsers.space.id', operator: 'equals', value: 'space-1' };
    const mjml = `<mj-text>${block(tagA, `inner ${block(space)}`)}{{#if rule=${JSON.stringify(tagB)}}}B{{else if rule=${JSON.stringify(tagA)}}}A{{else}}none{{/if}}</mj-text>`;
    const subject = `Hello ${block(space, 'there')}`;
    expect(contentRuleReferences(subject, mjml)).toEqual({
      references: [
        { model: 'Space', id: 'space-1' },
        { model: 'Tag', id: 'tag-a' },
        { model: 'Tag', id: 'tag-b' },
      ],
      dynamic: false,
    });
  });

  it('content without conditionals names nothing', () => {
    expect(contentRuleReferences('<mj-text>Hi {{recipient.name}}</mj-text>')).toEqual({
      references: [],
      dynamic: false,
    });
  });
});
