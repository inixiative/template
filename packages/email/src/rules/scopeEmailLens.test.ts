import { describe, expect, it } from 'bun:test';
import { defaultRecipientNarrowing } from '@template/email/rules/emailLens';
import {
  EMAIL_OWNER_SCOPES,
  EMAIL_SENDER_SCOPES,
  emailLensBindings,
} from '@template/email/rules/scopeEmailLens';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const ORG = '00000000-0000-7000-8000-000000000001';
const SPACE = '00000000-0000-7000-8000-000000000002';

describe('scopeEmailLens — static scopes, bound per row', () => {
  it('the owner and sender scopes are static objects that name owners only by bind token', () => {
    const serialized = JSON.stringify({ EMAIL_OWNER_SCOPES, EMAIL_SENDER_SCOPES });
    expect(serialized).not.toMatch(UUID);
    expect(serialized).not.toContain('"value"');
    expect(serialized).toContain('"bind":"organizationId"');
  });

  it('the recipient narrowing is one static object per sender kind, the space bound by token', () => {
    const first = defaultRecipientNarrowing({ ownerModel: 'Space', ownerId: SPACE });
    const second = defaultRecipientNarrowing({ ownerModel: 'Space', ownerId: ORG });
    expect(first).toBe(second);
    expect(JSON.stringify(first)).toContain('"bind":"senderSpaceId"');
    expect(JSON.stringify(first)).not.toMatch(UUID);
  });

  it('the row supplies only bindings', () => {
    expect(
      emailLensBindings(
        { ownerModel: 'Space', ownerId: SPACE, organizationId: ORG },
        { ownerModel: 'Space', ownerId: SPACE, organizationId: ORG },
      ),
    ).toEqual({
      spaceId: SPACE,
      ownerOrganizationId: ORG,
      senderOrganizationId: ORG,
      senderSpaceId: SPACE,
    });
    expect(emailLensBindings({ ownerModel: 'Organization', ownerId: ORG }, null)).toEqual({
      organizationId: ORG,
    });
    expect(emailLensBindings(null, null)).toEqual({});
  });
});
