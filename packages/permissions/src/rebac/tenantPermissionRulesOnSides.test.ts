import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import { ActorModel, createPermissions, installPermissions } from '@template/permissions/client';
import { canGrantEntitlement } from '@template/permissions/rebac/canGrantEntitlement';
import { check } from '@template/permissions/rebac/check';
import { tenantPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';
import { StoredPermissionRuleRefusedError } from '@template/permissions/rebac/storedPermissionRuleRefusedError';
import type { ActionRule } from '@template/permissions/rebac/types';
import { permissionsOfUser } from '@template/permissions/roles/permissionsOfUser';

type Rules = Record<string, Record<string, ActionRule>>;

const sender = (tenantPermissionRules?: Rules) => ({ id: 'o1', tenantPermissionRules });
const receiver = (tenantPermissionRules?: Rules) => ({ id: 'o2', tenantPermissionRules });

const reads = async (seat: { o1?: Role; o2?: Role }, inquiry: object) => {
  const permix = createPermissions();
  await installPermissions(
    permix,
    permissionsOfUser(
      'u1',
      [
        ...(seat.o1 ? [{ organizationId: 'o1', role: seat.o1 }] : []),
        ...(seat.o2 ? [{ organizationId: 'o2', role: seat.o2 }] : []),
      ],
      [],
    ),
  );
  permix.setActor({ model: ActorModel.User, record: { id: 'u1' } });
  return check(permix, 'inquiry', inquiry as HydratedRecord, 'read');
};

const between = (source: object & { id: string }, target: object & { id: string }) => ({
  id: 'i1',
  type: 'transferSpace',
  sourceModel: 'Organization',
  sourceOrganizationId: source.id,
  sourceOrganization: source,
  sourceSpaceId: null,
  sourceUserId: null,
  targetModel: 'Organization',
  targetOrganizationId: target.id,
  targetOrganization: target,
  targetSpaceId: null,
  targetUserId: null,
});

const whoeverReads = (relation: string): ActionRule => ({ rel: relation, action: 'read' });

describe('a tenant rule on a two-sided record', () => {
  it('with no rule, a viewer of either party reads nothing: reading takes manage', async () => {
    expect(await reads({ o2: 'viewer' }, between(sender(), receiver()))).toBe(false);
    expect(await reads({ o1: 'viewer' }, between(sender(), receiver()))).toBe(false);
    expect(await reads({ o2: 'admin' }, between(sender(), receiver()))).toBe(true);
  });

  it('opens what the tenant received to its own readers, through its own side', async () => {
    const opened = receiver({ 'db:Inquiry': { read: whoeverReads('targetOrganization') } });
    expect(await reads({ o2: 'viewer' }, between(sender(), opened))).toBe(true);
    expect(await reads({ o1: 'viewer' }, between(sender(), opened))).toBe(false);
    expect(await reads({}, between(sender(), opened))).toBe(false);
  });

  it('the same rule does nothing where that tenant is on the other side', async () => {
    const opened = {
      ...receiver(),
      id: 'o1',
      tenantPermissionRules: { 'db:Inquiry': { read: whoeverReads('targetOrganization') } },
    };
    const sentByIt = between(opened, receiver());
    expect(await reads({ o2: 'viewer' }, sentByIt)).toBe(false);
    expect(await reads({ o1: 'viewer' }, sentByIt)).toBe(false);
  });

  it('a stored rule with no check on one of its own sides is refused, for whoever asks', async () => {
    for (const rule of [
      true,
      { rule: { field: 'type', operator: 'equals', value: 'transferSpace' } },
      { rel: 'targetOrganization', action: 'create' },
      { any: [whoeverReads('targetOrganization'), true] },
      whoeverReads('targetUser'),
    ] as ActionRule[]) {
      const inquiry = between(sender(), receiver({ 'db:Inquiry': { read: rule } }));
      for (const seat of [{}, { o1: 'viewer' }, { o2: 'viewer' }] as const)
        await expect(reads(seat, inquiry)).rejects.toBeInstanceOf(StoredPermissionRuleRefusedError);
    }
  });

  it('a rule for the side the tenant is not on here does nothing', async () => {
    const opened = receiver({ 'db:Inquiry': { read: whoeverReads('sourceOrganization') } });
    expect(await reads({ o2: 'viewer' }, between(sender(), opened))).toBe(false);
    expect(await reads({ o1: 'viewer' }, between(sender(), opened))).toBe(false);
  });

  it('each party opens its own side only, to its own readers only', async () => {
    const inquiry = between(
      sender({ 'db:Inquiry': { read: whoeverReads('sourceOrganization') } }),
      receiver(),
    );
    expect(await reads({ o1: 'viewer' }, inquiry)).toBe(true);
    expect(await reads({ o2: 'viewer' }, inquiry)).toBe(false);
  });

  it('a side check narrowed by a condition still counts', async () => {
    const narrowed: ActionRule = {
      all: [
        whoeverReads('targetOrganization'),
        { rule: { field: 'type', operator: 'equals', value: 'transferSpace' } },
      ],
    };
    const inquiry = between(sender(), receiver({ 'db:Inquiry': { read: narrowed } }));
    expect(await reads({ o2: 'viewer' }, inquiry)).toBe(true);
    expect(await reads({}, inquiry)).toBe(false);
    expect(await reads({ o2: 'viewer' }, { ...inquiry, type: 'inviteOrganizationUser' })).toBe(
      false,
    );
  });

  it("is refused on write unless it walks through one of the tenant kind's own sides", () => {
    const accepts = (rules: unknown) =>
      tenantPermissionRulesSchema('Organization').safeParse(rules).success;
    expect(accepts({ 'db:Inquiry': { read: whoeverReads('targetOrganization') } })).toBe(true);
    expect(accepts({ 'db:Inquiry': { read: whoeverReads('sourceOrganization') } })).toBe(true);
    expect(accepts({ 'db:Inquiry': { read: true } })).toBe(false);
    expect(accepts({ 'db:Inquiry': { read: whoeverReads('targetUser') } })).toBe(false);
    expect(accepts({ 'db:Inquiry': { resolve: whoeverReads('targetOrganization') } })).toBe(false);
    expect(accepts({ 'db:Inquiry': { send: whoeverReads('sourceOrganization') } })).toBe(false);
    expect(accepts({ 'db:Contact': { read: true } })).toBe(true);
  });

  it("a user and a space each name their own side's relation", () => {
    const accepts = (tenantModel: 'User' | 'Space', relation: string) =>
      tenantPermissionRulesSchema(tenantModel).safeParse({
        'db:Inquiry': { read: whoeverReads(relation) },
      }).success;
    expect(accepts('User', 'targetUser')).toBe(true);
    expect(accepts('User', 'targetOrganization')).toBe(false);
    expect(accepts('Space', 'sourceSpace')).toBe(true);
    expect(accepts('Space', 'targetOrganization')).toBe(false);
  });

  it('saving refuses a rule with no check on its own side: an action anyone holds, an any, true', () => {
    const accepts = (read: unknown) =>
      tenantPermissionRulesSchema('Organization').safeParse({ 'db:Inquiry': { read } }).success;
    expect(accepts({ rel: 'targetOrganization', action: 'create' })).toBe(false);
    expect(accepts({ any: [whoeverReads('targetOrganization'), true] })).toBe(false);
    expect(accepts(true)).toBe(false);
    expect(accepts({ all: [whoeverReads('targetOrganization'), true] })).toBe(true);
  });

  it("an organization's rule reaches what its space received, and never what is addressed to a member", async () => {
    const opened = receiver({ 'db:Inquiry': { read: whoeverReads('targetOrganization') } });
    const toMember = {
      ...between(sender(), opened),
      targetModel: 'OrganizationUser',
      targetUserId: 'u9',
      targetUser: { id: 'u9' },
    };
    const toSpace = {
      ...between(sender(), opened),
      targetModel: 'Space',
      targetSpaceId: 's2',
      targetSpace: { id: 's2', organizationId: 'o2', organization: opened },
    };
    expect(await reads({ o2: 'viewer' }, toSpace)).toBe(true);
    expect(await reads({ o1: 'viewer' }, toSpace)).toBe(false);
    expect(await reads({ o2: 'viewer' }, toMember)).toBe(false);
  });

  it('a rule that reads what the record does not have is refused on write, on a side and off one', () => {
    const readsNothingThere = { rule: { field: 'noSuchColumn', operator: 'equals', value: 'x' } };
    const accepts = (rules: unknown) =>
      tenantPermissionRulesSchema('Organization').safeParse(rules).success;
    expect(accepts({ 'db:Contact': { read: readsNothingThere } })).toBe(false);
    expect(
      accepts({
        'db:Inquiry': { read: { all: [whoeverReads('targetOrganization'), readsNothingThere] } },
      }),
    ).toBe(false);
  });

  it('a stored rule the library refuses is a StoredPermissionRuleRefusedError, from the check and from the grant check', async () => {
    const refused = receiver({
      'db:Inquiry': {
        read: {
          all: [
            whoeverReads('targetOrganization'),
            { rule: { field: 'noSuchColumn', operator: 'equals', value: 'x' } },
          ],
        },
      },
    });
    const inquiry = between(sender(), refused);
    await expect(reads({ o2: 'viewer' }, inquiry)).rejects.toBeInstanceOf(
      StoredPermissionRuleRefusedError,
    );
    expect(() =>
      canGrantEntitlement(
        createPermissions(),
        {
          resource: 'db:Inquiry',
          anchor: { resource: 'db:Inquiry', id: 'i1' },
          actions: { read: true },
        },
        inquiry as HydratedRecord,
      ),
    ).toThrow(StoredPermissionRuleRefusedError);
  });
});
