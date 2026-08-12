import { describe, expect, it } from 'bun:test';
import { registry } from '#/lib/email/registry';
import { resolveData, resolveEntity, resolveRecipients, resolveSenderIdentity } from '#/lib/email/resolveEntry';

const inquiry = registry['inquiry-invite-organization-user'];

describe('resolveEntity', () => {
  it('binds the entity where from the handoff', () => {
    const lens = resolveEntity(inquiry, { inquiryId: 'inq-1' });
    expect((lens.root as { where: unknown }).where).toEqual({ field: 'id', operator: 'equals', value: 'inq-1' });
  });

  it('keeps the static picks/relations surface', () => {
    const lens = resolveEntity(inquiry, { inquiryId: 'inq-1' });
    const root = lens.root as { picks: string[]; relations: unknown };
    expect(root.picks).toEqual(['id', 'content', 'sourceOrganization']);
    expect(root.relations).toEqual({ sourceOrganization: { picks: ['name'] } });
  });
});

describe('resolveSenderIdentity', () => {
  it('platform needs no bindings', () => {
    expect(resolveSenderIdentity(registry.welcome.sender, {})).toEqual({ type: 'platform' });
  });

  it('Organization binds organizationId from the entity', () => {
    expect(resolveSenderIdentity(inquiry.sender, { sourceOrganizationId: 'org-9' })).toEqual({
      type: 'Organization',
      organizationId: 'org-9',
    });
  });
});

describe('resolveRecipients', () => {
  it('binds the recipient id from the entity and keeps the User-rooted surface', () => {
    const lens = resolveRecipients(registry.welcome.recipients, { id: 'u42' }, { type: 'platform' });
    expect((lens.root as { where: unknown }).where).toEqual({ field: 'id', operator: 'equals', value: 'u42' });
    expect((lens.root as { picks: string[] }).picks).toEqual(['id', 'name', 'email']);
  });

  it('resolves the inquiry recipient from the entity target', () => {
    const lens = resolveRecipients(inquiry.recipients, { targetUserId: 'u-7' }, { type: 'platform' });
    expect((lens.root as { where: unknown }).where).toEqual({ field: 'id', operator: 'equals', value: 'u-7' });
  });
});

describe('resolveData', () => {
  it('projects declared paths from the handoff', () => {
    expect(resolveData(registry['email-verification'], {}, { verificationUrl: 'https://x/y' })).toEqual({
      verificationUrl: 'https://x/y',
    });
  });

  it('is undefined when the entry declares no data projection', () => {
    expect(resolveData(registry.welcome, {}, {})).toBeUndefined();
  });
});
