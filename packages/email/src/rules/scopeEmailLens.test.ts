import { describe, expect, it } from 'bun:test';
import {
  type Condition,
  listBindings,
  listLensBindings,
  type NarrowingDefaults,
} from '@inixiative/json-rules';
import {
  defaultRecipientNarrowing,
  emailLens,
  emailSlotLenses,
} from '@template/email/rules/emailLens';
import {
  type EmailLensOwner,
  emailLensBindings,
  emailScopeFor,
} from '@template/email/rules/scopeEmailLens';
import { OWNER_EMAIL_SCOPE } from '@template/email/rules/scopes/ownerEmailScope';
import { PLATFORM_EMAIL_SCOPE } from '@template/email/rules/scopes/platformEmailScope';
import { PLATFORM_OWNER_EMAIL_SCOPE } from '@template/email/rules/scopes/platformOwnerEmailScope';
import { TENANT_EMAIL_SCOPE } from '@template/email/rules/scopes/tenantEmailScope';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

const ORG = '00000000-0000-7000-8000-000000000001';
const SPACE = '00000000-0000-7000-8000-000000000002';

describe('scopeEmailLens — static scopes, bound per row', () => {
  it('each scope is a static, serializable object that names owners only by bind token', () => {
    for (const scope of [
      TENANT_EMAIL_SCOPE,
      OWNER_EMAIL_SCOPE,
      PLATFORM_OWNER_EMAIL_SCOPE,
      PLATFORM_EMAIL_SCOPE,
    ]) {
      expect(JSON.parse(JSON.stringify(scope))).toEqual(scope);
      expect(JSON.stringify(scope)).not.toMatch(UUID);
    }
  });

  it('every scope token is optional: an unsupplied one matches no row', () => {
    const tokens = (scope: NarrowingDefaults['models'], required: boolean): string[] =>
      [
        ...new Set(
          Object.values(scope ?? {}).flatMap((model) =>
            [
              model.where,
              ...Object.values(model.sources ?? {}).map(
                (source) => (source as { where?: Condition }).where,
              ),
            ]
              .filter((where): where is Condition => where !== undefined)
              .flatMap((where) => listBindings(where, { required })),
          ),
        ),
      ].sort();
    expect(tokens(TENANT_EMAIL_SCOPE, false)).toEqual([
      'organizationId',
      'ownerOrganizationId',
      'senderOrganizationId',
      'spaceId',
      'userId',
    ]);
    expect(tokens(PLATFORM_OWNER_EMAIL_SCOPE, false)).toEqual([
      'organizationId',
      'senderOrganizationId',
      'spaceId',
      'userId',
    ]);
    expect(tokens(OWNER_EMAIL_SCOPE, false)).toEqual([
      'organizationId',
      'ownerOrganizationId',
      'spaceId',
      'userId',
    ]);
    expect(tokens(PLATFORM_EMAIL_SCOPE, false)).toEqual(['organizationId', 'spaceId', 'userId']);
    for (const scope of [
      TENANT_EMAIL_SCOPE,
      OWNER_EMAIL_SCOPE,
      PLATFORM_OWNER_EMAIL_SCOPE,
      PLATFORM_EMAIL_SCOPE,
    ])
      expect(tokens(scope, true)).toEqual([]);
  });

  const OWNERS: Record<string, NonNullable<EmailLensOwner>> = {
    Organization: { ownerModel: 'Organization', ownerId: ORG },
    Space: { ownerModel: 'Space', ownerId: SPACE, organizationId: ORG },
    User: { ownerModel: 'User', ownerId: '00000000-0000-7000-8000-000000000003' },
  };

  it('a scope is chosen by whether the owner and the sender are tenants', () => {
    for (const owner of Object.values(OWNERS)) {
      for (const sender of Object.values(OWNERS))
        expect(emailScopeFor(owner, sender)).toBe(TENANT_EMAIL_SCOPE);
      expect(emailScopeFor(owner, null)).toBe(OWNER_EMAIL_SCOPE);
      expect(emailScopeFor(null, owner)).toBe(PLATFORM_OWNER_EMAIL_SCOPE);
    }
    expect(emailScopeFor(null, null)).toBe(PLATFORM_EMAIL_SCOPE);
  });

  it('the bindings a row supplies cover every token a lens requires, for every owner and sender', () => {
    const cases: [EmailLensOwner, EmailLensOwner][] = [
      [null, null],
      ...Object.values(OWNERS).map((owner): [EmailLensOwner, EmailLensOwner] => [owner, null]),
      ...Object.values(OWNERS).map((sender): [EmailLensOwner, EmailLensOwner] => [null, sender]),
      ...Object.values(OWNERS).flatMap((owner) =>
        Object.values(OWNERS).map((sender): [EmailLensOwner, EmailLensOwner] => [owner, sender]),
      ),
    ];
    const required = new Set<string>();
    for (const [owner, sender] of cases) {
      const lens = emailLens({
        scope: emailScopeFor(owner, sender),
        recipientDefault: defaultRecipientNarrowing(sender),
      });
      const supplied = Object.keys(emailLensBindings(owner, sender));
      for (const [, slot] of emailSlotLenses(lens))
        for (const name of listLensBindings(slot)) {
          required.add(name);
          expect([owner?.ownerModel, sender?.ownerModel, supplied]).toEqual([
            owner?.ownerModel,
            sender?.ownerModel,
            expect.arrayContaining([name]),
          ]);
        }
    }
    expect([...required]).toEqual(['senderSpaceId']);
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
