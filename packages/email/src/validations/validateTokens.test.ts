import { describe, expect, it } from 'bun:test';
import type { FieldMap } from '@inixiative/field-map';
import { createLens } from '@inixiative/json-rules';
import { tokenGuardedByExistsCheck } from '@template/email/render/tokenGuardedByExistsCheck';
import { type EmailLens, OPAQUE_SLOT, systemFieldsSlotLens } from '@template/email/rules/emailLens';
import { validateTokens } from '@template/email/validations/validateTokens';

const map: FieldMap = {
  models: {
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
const lens: EmailLens = {
  recipient: {
    parent: createLens({ maps: { prisma: map }, mapName: 'prisma', model: 'User' }),
    root: { relations: { account: {}, contacts: {} } },
  },
  sender: createLens({ maps: { prisma: map }, mapName: 'prisma', model: 'Organization' }),
  data: OPAQUE_SLOT,
  system: systemFieldsSlotLens(),
};

const messages = (content: string) =>
  validateTokens(content, { lens }).map((issue) => issue.message);

describe('validateTokens — what the lens can decide is decided at save', () => {
  it('accepts a required path and a system token', () => {
    expect(messages('Hi {{recipient.name}} from {{sender.name}} on {{system.now}}')).toEqual([]);
  });

  it('refuses an unknown root, an unknown path, and a mustache the engine does not understand', () => {
    expect(messages('{{Recipient.name}}')[0]).toContain(
      'is not a token or block the engine understands',
    );
    expect(messages('{{foo.bar}}')[0]).toContain('names no scope root');
    expect(messages('{{recipient.nickname}}')[0]).toContain(
      "is not provided by this template's lens",
    );
    expect(messages('{{recipient.name.first}}')[0]).toContain('reads through a scalar');
    expect(messages('{{recipient.account}}')[0]).toContain('is an object, not a value');
    expect(messages('{{system.nope}}')[0]).toContain("is not provided by this template's lens");
  });

  it('refuses an optional path that is not guarded, and accepts the guarded form', () => {
    expect(messages('{{recipient.phone}}')[0]).toContain('may be empty');
    expect(messages(tokenGuardedByExistsCheck('recipient.phone', 'no phone'))).toEqual([]);
    expect(messages('{{recipient.account.plan}}')[0]).toContain('may be empty');
    expect(
      messages(
        '{{#if rule={"field":"recipient.account","operator":"exists"}}}{{recipient.account.plan}}{{/if}}',
      ),
    ).toEqual([]);
  });

  it('a negated or absent-polarity rule guards nothing, and the else branch is never guarded', () => {
    expect(
      messages(
        '{{#if rule={"field":"recipient.phone","operator":"notExists"}}}{{recipient.phone}}{{/if}}',
      )[0],
    ).toContain('may be empty');
    expect(
      messages(
        '{{#if rule={"field":"recipient.phone","operator":"exists"}}}ok{{else}}{{recipient.phone}}{{/if}}',
      )[0],
    ).toContain('may be empty');
    expect(
      messages(
        '{{#if rule={"any":[{"field":"recipient.phone","operator":"exists"}]}}}{{recipient.phone}}{{/if}}',
      )[0],
    ).toContain('may be empty');
  });

  it('a guard on a prefix covers the token only when the prefix is where the optionality lives', () => {
    expect(
      messages(
        '{{#if rule={"field":"recipient","operator":"exists"}}}{{recipient.phone}}{{/if}}',
      )[0],
    ).toContain('may be empty');
  });

  it('data is Json: every path beneath it is optional and needs a guard', () => {
    expect(messages('{{data.code}}')[0]).toContain('may be empty');
    expect(messages(tokenGuardedByExistsCheck('data.code'))).toEqual([]);
  });

  it('lists are iterated, not addressed; loop bindings resolve through the lens', () => {
    expect(messages('{{recipient.contacts.value}}')[0]).toContain('iterate it with {{#each}}');
    expect(messages('{{#each recipient.contacts as=c}}{{c.value}}{{/each}}')).toEqual([]);
    expect(messages('{{#each recipient.contacts as=c}}{{c}}{{/each}}')[0]).toContain(
      'names the loop element',
    );
    expect(messages('{{#each recipient.tags as=t}}{{t}}{{/each}}')).toEqual([]);
    expect(messages('{{#each recipient.contacts as=c index=i}}{{i}}{{/each}}')).toEqual([]);
  });

  it('without a lens only the grammar is decided', () => {
    expect(
      validateTokens('{{recipient.anything}} {{Nope}}').map((issue) => issue.message)[0],
    ).toContain('is not a token or block');
    expect(validateTokens('{{recipient.anything}}')).toEqual([]);
  });
});

describe('validateTokens — guards the review found gameable', () => {
  it('a guard on the Json root does not cover a path beneath it', () => {
    expect(
      messages('{{#if rule={"field":"data","operator":"exists"}}}{{data.anything}}{{/if}}')[0],
    ).toContain('may be empty');
  });

  it('a scalar list outside a loop is a list, not a value', () => {
    expect(messages('{{recipient.tags}}')[0]).toContain('is a list');
  });

  it('a subject cannot iterate', () => {
    expect(
      validateTokens('{{#each recipient.tags as=t}}{{t}}{{/each}}', { lens, isSubject: true }).map(
        (issue) => issue.message,
      )[0],
    ).toContain('not allowed in the subject');
  });
});

describe('validateTokens — {{datetime}}', () => {
  it('accepts a known time zone and no time zone', () => {
    expect(validateTokens('{{datetime data.at tz=America/New_York}} {{datetime data.at}}')).toEqual(
      [],
    );
  });

  it('refuses a time zone it does not know, instead of printing UTC', () => {
    expect(
      validateTokens('{{datetime data.at tz=Mars/Olympus}}').map((issue) => issue.message),
    ).toEqual(['{{datetime}} has an unknown time zone: Mars/Olympus']);
  });

  it('accepts a date-fns format, with and without a time zone', () => {
    expect(
      validateTokens(
        '{{datetime data.at format="MMM d, h:mm a zzz"}} {{datetime data.at format="PPpp" tz=Europe/Paris}}',
      ),
    ).toEqual([]);
  });

  it('refuses a format date-fns refuses, and says so beside the path check', () => {
    expect(messages('{{datetime data.at format="hello"}}')).toContain(
      '{{datetime}} has an invalid format: hello',
    );
    expect(messages('{{datetime data.at format="YYYY"}}')).toContain(
      '{{datetime}} has an invalid format: YYYY',
    );
  });

  it('refuses letters that are not display tokens, so a word left unquoted never prints garbage', () => {
    for (const format of ['MMM d at h:mm a', 'T', 't', 'abc', "d 'of MMM", "'it''"]) {
      expect(messages(`{{datetime data.at format="${format}"}}`)).toContain(
        `{{datetime}} has an invalid format: ${format}`,
      );
    }
  });

  it('reports every problem with one token', () => {
    expect(messages('{{datetime nope.at format="hello" tz=Mars/Olympus}}')).toEqual([
      '{{datetime}} has an invalid format: hello',
      '{{datetime}} has an unknown time zone: Mars/Olympus',
      expect.stringContaining('names no scope root'),
    ]);
  });

  it('checks the path the way a plain token is checked', () => {
    expect(messages('{{datetime recipient.missing}}')[0]).toContain('is not provided');
    expect(messages('{{datetime nope.at}}')[0]).toContain('names no scope root');
  });
});
