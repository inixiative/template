import { describe, expect, it } from 'bun:test';
import { bindLens } from '#/lib/email/bindLens';
import { bindWhere } from '#/lib/email/bindWhere';
import { pickSender } from '#/lib/email/pickSender';
import { registry } from '#/lib/email/registry';

const inquiry = registry['inquiry-invite-organization-user'];

describe('bindLens', () => {
  it('binds the entity where from the handoff by name', () => {
    const lens = bindLens(inquiry.entity, { inquiryId: 'inq-1' });
    expect((lens.root as { where: unknown }).where).toEqual({ field: 'id', operator: 'equals', value: 'inq-1' });
  });

  it('keeps the static picks/relations surface', () => {
    const root = bindLens(inquiry.entity, { inquiryId: 'inq-1' }).root as { picks: string[]; relations: unknown };
    expect(root.picks).toEqual(['id', 'content', 'sourceOrganizationId', 'targetUserId', 'sourceOrganization']);
    expect(root.relations).toEqual({ sourceOrganization: { picks: ['name'] } });
  });

  it('throws when the handoff does not carry a bound name', () => {
    expect(() => bindLens(inquiry.entity, {})).toThrow('Email bind "inquiryId" was not supplied');
  });
});

describe('bindWhere', () => {
  it('binds the recipient id from the entity row by name', () => {
    expect(bindWhere(inquiry.recipients.where, { targetUserId: 'u-7' })).toEqual({
      field: 'id',
      operator: 'equals',
      value: 'u-7',
    });
  });

  it('throws on a name the row does not carry instead of addressing nobody', () => {
    expect(() => bindWhere(inquiry.recipients.where, { targetUser: 'u-7' })).toThrow(
      'Email bind "targetUserId" was not supplied',
    );
  });

  it('passes a present null through so the where fails closed', () => {
    expect(bindWhere(inquiry.recipients.where, { targetUserId: null })).toEqual({
      field: 'id',
      operator: 'equals',
      value: null,
    });
  });
});

describe('pickSender', () => {
  it('platform reads nothing from the entity', () => {
    expect(pickSender(registry.welcome.sender, {})).toEqual({ type: 'platform' });
  });

  it('Organization reads its id from the named entity field', () => {
    expect(pickSender(inquiry.sender, { sourceOrganizationId: 'org-9' })).toEqual({
      type: 'Organization',
      organizationId: 'org-9',
    });
  });

  it('throws when the named field is empty', () => {
    expect(() => pickSender(inquiry.sender, { sourceOrganizationId: null })).toThrow(
      'Sender organizationId reads entity field "sourceOrganizationId", which is empty',
    );
  });
});

describe('bindOptional', () => {
  const where = {
    all: [
      { field: 'id', operator: 'equals', bind: 'targetUserId' },
      { field: 'locale', operator: 'equals', bind: 'locale', bindOptional: true },
    ],
  } as const;

  it('an optional name the row does not carry is not required and stays a token for the compiler', () => {
    expect(bindWhere(where as never, { targetUserId: 'u-7' })).toEqual({
      all: [
        { field: 'id', operator: 'equals', value: 'u-7' },
        { field: 'locale', operator: 'equals', bind: 'locale', bindOptional: true },
      ],
    });
  });

  it('a required name is still refused when absent, optional or not beside it', () => {
    expect(() => bindWhere(where as never, { locale: 'en' })).toThrow('Email bind "targetUserId" was not supplied');
  });
});
