import { describe, expect, it } from 'bun:test';
import type { Condition } from '@inixiative/json-rules';
import { defaultEmailLens, emailRuleReferences } from '@template/email/rules/emailLens';
import { contentRuleReferences } from '@template/email/rules/ruleReferences';

const block = (rule: unknown, body = 'X') => `{{#if rule=${JSON.stringify(rule)}}}${body}{{/if}}`;

describe('ruleReferences — the rows an email rule names', () => {
  it('a membership rule over recipient tags names each tag', () => {
    const rule: Condition = {
      field: 'recipient.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.id', operator: 'in', value: ['tag-a', 'tag-b'] },
    };
    expect(emailRuleReferences(defaultEmailLens, rule)).toEqual([
      { model: 'Tag', id: 'tag-a' },
      { model: 'Tag', id: 'tag-b' },
    ]);
  });

  it('space and organization membership, crossed under an array rule, name their rows', () => {
    const rule: Condition = {
      any: [
        {
          field: 'recipient.spaceUsers',
          arrayOperator: 'any',
          condition: { field: 'space.id', operator: 'equals', value: 'space-1' },
        },
        {
          field: 'recipient.organizationUsers',
          arrayOperator: 'any',
          condition: { field: 'organization.id', operator: 'notEquals', value: 'org-1' },
        },
      ],
    };
    expect(emailRuleReferences(defaultEmailLens, rule)).toEqual([
      { model: 'Space', id: 'space-1' },
      { model: 'Organization', id: 'org-1' },
    ]);
  });

  it('a dotted path through a to-many relation names nothing: the lens gate refuses it (json-rules 4.0)', () => {
    const rule: Condition = {
      field: 'recipient.spaceUsers.space.id',
      operator: 'equals',
      value: 'space-1',
    };
    expect(emailRuleReferences(defaultEmailLens, rule)).toEqual([]);
  });

  it('a recipient named by id is a User reference: every rebac resource is referenceable, for entitlement wheres (2026-11-03)', () => {
    const rule: Condition = { field: 'recipient.id', operator: 'equals', value: 'user-1' };
    expect(emailRuleReferences(defaultEmailLens, rule)).toEqual([{ model: 'User', id: 'user-1' }]);
  });

  it('vocabulary values, plain recipient fields, sender and data name no rows', () => {
    const rule: Condition = {
      all: [
        {
          field: 'recipient.tagAttachments',
          arrayOperator: 'any',
          condition: { field: 'tag.name', operator: 'equals', value: 'vip' },
        },
        { field: 'recipient.name', operator: 'equals', value: 'tag-a' },
        { field: 'sender.id', operator: 'equals', value: 'tag-a' },
        { field: 'data.tagId', operator: 'equals', value: 'tag-a' },
      ],
    };
    expect(emailRuleReferences(defaultEmailLens, rule)).toEqual([]);
  });

  it('a row read from path or bind names nothing — there is no edge to register', () => {
    const fromPath: Condition = {
      field: 'recipient.tagAttachments.tag.id',
      operator: 'equals',
      path: 'data.tagId',
    };
    const fromBind: Condition = {
      field: 'recipient.tagAttachments.tag.id',
      operator: 'equals',
      bind: 'tagId',
    };
    expect(emailRuleReferences(defaultEmailLens, fromPath)).toEqual([]);
    expect(emailRuleReferences(defaultEmailLens, fromBind)).toEqual([]);
  });

  it('an operator that describes the row without naming it names nothing', () => {
    const rule: Condition = {
      field: 'recipient.tagAttachments.tag.id',
      operator: 'contains',
      value: 'abc',
    };
    expect(emailRuleReferences(defaultEmailLens, rule)).toEqual([]);
  });

  it('contentRuleReferences folds every block, branch and nesting across contents, deduped', () => {
    const member = (field: string, related: string, value: string): Condition => ({
      field,
      arrayOperator: 'any',
      condition: { field: related, operator: 'equals', value },
    });
    const tagA = member('recipient.tagAttachments', 'tag.id', 'tag-a');
    const tagB = member('recipient.tagAttachments', 'tag.id', 'tag-b');
    const space = member('recipient.spaceUsers', 'space.id', 'space-1');
    const mjml = `<mj-text>${block(tagA, `inner ${block(space)}`)}{{#if rule=${JSON.stringify(tagB)}}}B{{else if rule=${JSON.stringify(tagA)}}}A{{else}}none{{/if}}</mj-text>`;
    const subject = `Hello ${block(space, 'there')}`;
    expect(contentRuleReferences(defaultEmailLens, subject, mjml)).toEqual([
      { model: 'Space', id: 'space-1' },
      { model: 'Tag', id: 'tag-a' },
      { model: 'Tag', id: 'tag-b' },
    ]);
  });

  it('loop-bound rules name their rows: an {{#if}} in a loop, an each filter, nested loops, subject and mjml', () => {
    const json = (rule: Condition) => JSON.stringify(rule);
    const inLoop = `{{#each recipient.tagAttachments as=t}}{{#if rule=${json({ field: 't.tag.id', operator: 'equals', value: 'tag-a' })}}}A{{/if}}{{/each}}`;
    const filtered = `{{#each recipient.tagAttachments as=t filter=${json({ field: 't.tag.id', operator: 'equals', value: 'tag-b' })}}}B{{/each}}`;
    const nested = `{{#each recipient.organizationUsers as=ou}}{{#each recipient.spaceUsers as=su filter=${json({ field: 'su.space.id', operator: 'in', value: ['space-2'] })}}}{{#if rule=${json({ field: 'su.space.id', operator: 'in', value: ['space-1'] })}}}S{{/if}}{{/each}}{{/each}}`;
    const subject = `Hi ${block({ field: 'recipient.organizationUsers', arrayOperator: 'any', condition: { field: 'organization.id', operator: 'equals', value: 'org-1' } })}`;
    const mjml = `<mj-text>${inLoop}${filtered}${nested}</mj-text>`;
    expect(contentRuleReferences(defaultEmailLens, subject, mjml)).toEqual([
      { model: 'Organization', id: 'org-1' },
      { model: 'Tag', id: 'tag-a' },
      { model: 'Tag', id: 'tag-b' },
      { model: 'Space', id: 'space-2' },
      { model: 'Space', id: 'space-1' },
    ]);
  });

  it('content without conditionals names nothing', () => {
    expect(
      contentRuleReferences(defaultEmailLens, '<mj-text>Hi {{recipient.name}}</mj-text>'),
    ).toEqual([]);
  });
});
