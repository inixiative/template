import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import type { Role } from '@template/db/generated/client/enums';
import { ActorModel, createPermissions, installPermissions } from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { tenantPermissionRulesSchema } from '@template/permissions/rebac/permissionRulesSchema';
import { rebacSchema } from '@template/permissions/rebac/schema';
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
  return check(permix, rebacSchema, 'inquiry', inquiry as HydratedRecord, 'read');
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
    const opened = receiver({ 'db:inquiry': { read: whoeverReads('targetOrganization') } });
    expect(await reads({ o2: 'viewer' }, between(sender(), opened))).toBe(true);
    expect(await reads({ o1: 'viewer' }, between(sender(), opened))).toBe(false);
    expect(await reads({}, between(sender(), opened))).toBe(false);
  });

  it('the same rule does nothing where that tenant is on the other side', async () => {
    const opened = {
      ...receiver(),
      id: 'o1',
      tenantPermissionRules: { 'db:inquiry': { read: whoeverReads('targetOrganization') } },
    };
    const sentByIt = between(opened, receiver());
    expect(await reads({ o2: 'viewer' }, sentByIt)).toBe(false);
    expect(await reads({ o1: 'viewer' }, sentByIt)).toBe(false);
  });

  it('a stored rule that is not a walk through its own side widens nothing', async () => {
    for (const rule of [
      true,
      whoeverReads('sourceOrganization'),
      { rule: { field: 'type', operator: 'equals', value: 'transferSpace' } },
    ] as ActionRule[]) {
      const opened = receiver({ 'db:inquiry': { read: rule } });
      expect(await reads({}, between(sender(), opened))).toBe(false);
      expect(await reads({ o1: 'viewer' }, between(sender(), opened))).toBe(false);
      expect(await reads({ o2: 'viewer' }, between(sender(), opened))).toBe(false);
    }
  });

  it('each party opens its own side only, to its own readers only', async () => {
    const inquiry = between(
      sender({ 'db:inquiry': { read: whoeverReads('sourceOrganization') } }),
      receiver(),
    );
    expect(await reads({ o1: 'viewer' }, inquiry)).toBe(true);
    expect(await reads({ o2: 'viewer' }, inquiry)).toBe(false);
  });

  it('a walk narrowed by a condition still counts; an any with a free arm does not', async () => {
    const narrowed: ActionRule = {
      all: [
        whoeverReads('targetOrganization'),
        { rule: { field: 'type', operator: 'equals', value: 'transferSpace' } },
      ],
    };
    expect(
      await reads(
        { o2: 'viewer' },
        between(sender(), receiver({ 'db:inquiry': { read: narrowed } })),
      ),
    ).toBe(true);
    const escaped: ActionRule = { any: [whoeverReads('targetOrganization'), true] };
    expect(await reads({}, between(sender(), receiver({ 'db:inquiry': { read: escaped } })))).toBe(
      false,
    );
  });

  it("is refused on write unless it walks through one of the tenant kind's own sides", () => {
    const accepts = (rules: unknown) =>
      tenantPermissionRulesSchema('Organization').safeParse(rules).success;
    expect(accepts({ 'db:inquiry': { read: whoeverReads('targetOrganization') } })).toBe(true);
    expect(accepts({ 'db:inquiry': { read: whoeverReads('sourceOrganization') } })).toBe(true);
    expect(accepts({ 'db:inquiry': { read: true } })).toBe(false);
    expect(accepts({ 'db:inquiry': { read: whoeverReads('targetUser') } })).toBe(false);
    expect(accepts({ 'db:inquiry': { resolve: whoeverReads('targetOrganization') } })).toBe(false);
    expect(accepts({ 'db:inquiry': { send: whoeverReads('sourceOrganization') } })).toBe(false);
    expect(accepts({ 'db:contact': { read: true } })).toBe(true);
  });

  it("a user and a space each name their own side's relation", () => {
    const accepts = (tenantModel: 'User' | 'Space', relation: string) =>
      tenantPermissionRulesSchema(tenantModel).safeParse({
        'db:inquiry': { read: whoeverReads(relation) },
      }).success;
    expect(accepts('User', 'targetUser')).toBe(true);
    expect(accepts('User', 'targetOrganization')).toBe(false);
    expect(accepts('Space', 'sourceSpace')).toBe(true);
    expect(accepts('Space', 'targetOrganization')).toBe(false);
  });

  it('an action anyone holds on the tenant is not a way in: the walk asks read, operate, manage or own', async () => {
    const anyoneCreates: ActionRule = { rel: 'targetOrganization', action: 'create' };
    expect(
      tenantPermissionRulesSchema('Organization').safeParse({
        'db:inquiry': { read: anyoneCreates },
      }).success,
    ).toBe(false);
    const opened = receiver({ 'db:inquiry': { read: anyoneCreates } });
    expect(await reads({}, between(sender(), opened))).toBe(false);
  });

  it("an organization's rule reaches what its space received, and never what is addressed to a member", async () => {
    const opened = receiver({ 'db:inquiry': { read: whoeverReads('targetOrganization') } });
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
});
