import { describe, expect, it } from 'bun:test';
import { createLens, type FieldMap } from '@inixiative/json-rules';
import { guardedToken } from '@template/email/render/guardedToken';
import { validateTokens } from '@template/email/validations/validateTokens';

const map: FieldMap = {
  models: {
    EmailRuleContext: {
      fields: {
        recipient: { kind: 'object', type: 'User', isRequired: true },
        sender: { kind: 'object', type: 'Organization', isRequired: true },
        data: { kind: 'scalar', type: 'Json' },
      },
    },
    User: {
      fields: {
        id: { kind: 'scalar', type: 'String', isRequired: true },
        name: { kind: 'scalar', type: 'String', isRequired: true },
        phone: { kind: 'scalar', type: 'String', isRequired: false },
        tags: { kind: 'scalar', type: 'String', isList: true },
        account: { kind: 'object', type: 'Account', isRequired: false },
        contacts: { kind: 'object', type: 'Contact', isList: true },
      },
    },
    Account: { fields: { plan: { kind: 'scalar', type: 'String', isRequired: true } } },
    Contact: { fields: { value: { kind: 'scalar', type: 'String', isRequired: true } } },
    Organization: { fields: { name: { kind: 'scalar', type: 'String', isRequired: true } } },
  },
};
const lens = createLens({ maps: { prisma: map }, mapName: 'prisma', model: 'EmailRuleContext' });

const messages = (content: string) => validateTokens(content, { lens }).map((issue) => issue.message);

describe('validateTokens — what the lens can decide is decided at save', () => {
  it('accepts a required path and a system token', () => {
    expect(messages('Hi {{recipient.name}} from {{sender.name}} on {{system.now}}')).toEqual([]);
  });

  it('refuses an unknown root, an unknown path, and a mustache the engine does not understand', () => {
    expect(messages('{{Recipient.name}}')[0]).toContain('is not a token or block the engine understands');
    expect(messages('{{foo.bar}}')[0]).toContain('names no scope root');
    expect(messages('{{recipient.nickname}}')[0]).toContain("is not provided by this template's lens");
    expect(messages('{{recipient.name.first}}')[0]).toContain('reads through a scalar');
    expect(messages('{{recipient.account}}')[0]).toContain('is an object, not a value');
    expect(messages('{{system.nope}}')[0]).toContain('is not a system token');
  });

  it('refuses an optional path that is not guarded, and accepts the guarded form', () => {
    expect(messages('{{recipient.phone}}')[0]).toContain('may be empty');
    expect(messages(guardedToken('recipient.phone', 'no phone'))).toEqual([]);
    expect(messages('{{recipient.account.plan}}')[0]).toContain('may be empty');
    expect(
      messages('{{#if rule={"field":"recipient.account","operator":"exists"}}}{{recipient.account.plan}}{{/if}}'),
    ).toEqual([]);
  });

  it('a negated or absent-polarity rule guards nothing, and the else branch is never guarded', () => {
    expect(
      messages('{{#if rule={"field":"recipient.phone","operator":"notExists"}}}{{recipient.phone}}{{/if}}')[0],
    ).toContain('may be empty');
    expect(
      messages('{{#if rule={"field":"recipient.phone","operator":"exists"}}}ok{{else}}{{recipient.phone}}{{/if}}')[0],
    ).toContain('may be empty');
    expect(
      messages('{{#if rule={"any":[{"field":"recipient.phone","operator":"exists"}]}}}{{recipient.phone}}{{/if}}')[0],
    ).toContain('may be empty');
  });

  it('a guard on a prefix covers the token only when the prefix is where the optionality lives', () => {
    expect(messages('{{#if rule={"field":"recipient","operator":"exists"}}}{{recipient.phone}}{{/if}}')[0]).toContain(
      'may be empty',
    );
  });

  it('data is Json: every path beneath it is optional and needs a guard', () => {
    expect(messages('{{data.code}}')[0]).toContain('may be empty');
    expect(messages(guardedToken('data.code'))).toEqual([]);
  });

  it('lists are iterated, not addressed; loop bindings resolve through the lens', () => {
    expect(messages('{{recipient.contacts.value}}')[0]).toContain('iterate it with {{#each}}');
    expect(messages('{{#each recipient.contacts as=c}}{{c.value}}{{/each}}')).toEqual([]);
    expect(messages('{{#each recipient.contacts as=c}}{{c}}{{/each}}')[0]).toContain('names the loop element');
    expect(messages('{{#each recipient.tags as=t}}{{t}}{{/each}}')).toEqual([]);
    expect(messages('{{#each recipient.contacts as=c index=i}}{{i}}{{/each}}')).toEqual([]);
  });

  it('without a lens only the grammar is decided', () => {
    expect(validateTokens('{{recipient.anything}} {{Nope}}').map((issue) => issue.message)[0]).toContain(
      'is not a token or block',
    );
    expect(validateTokens('{{recipient.anything}}')).toEqual([]);
  });
});
