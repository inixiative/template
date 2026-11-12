import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import { InquiryType, Role } from '@template/db/generated/client/enums';
import { prismaMap } from '@template/db/generated/prismaMap';
import {
  ActorModel,
  createPermissions,
  installPermissions,
  type Permix,
} from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { inquiryPartyRule, inquiryPermission } from '@template/permissions/rebac/inquiryPermission';
import { INQUIRY_TYPES } from '@template/permissions/rebac/inquiryTypes';
import { rebacSchema } from '@template/permissions/rebac/schema';
import type { ActionRule } from '@template/permissions/rebac/types';
import { permissionsOfUser } from '@template/permissions/roles/permissionsOfUser';
import { lowerFirst } from 'lodash-es';

type Gated = { any: { all: [{ rule: { operator: string; value: string } }, unknown] }[] };
type FieldEntry = { kind: string; type: string };

const fieldsOf = (model: string): Record<string, FieldEntry> =>
  (prismaMap.models as Record<string, { fields: Record<string, FieldEntry> }>)[model]?.fields ?? {};

const modelAt = (path: string): string | undefined =>
  path.split('.').reduce<string | undefined>((model, name) => {
    const field = model ? fieldsOf(model)[name] : undefined;
    return field?.kind === 'object' ? field.type : undefined;
  }, 'Inquiry');

const actionsOf = (model: string) =>
  Object.keys(rebacSchema.permissions[`db:${lowerFirst(model)}`]?.actions ?? {});

const leafNames = (rule: ActionRule): string[] => {
  if (rule === null || typeof rule === 'boolean') return [];
  if (typeof rule === 'string') return [`:${rule}`];
  if ('any' in rule) return rule.any.flatMap(leafNames);
  if ('all' in rule) return rule.all.flatMap(leafNames);
  if ('rel' in rule) return [`${rule.rel}:${rule.action}`];
  return [(rule.rule as { field: string }).field];
};

const isKnown = (name: string) => {
  if (!name.includes(':')) return name.split('.')[0] in fieldsOf('Inquiry');
  const [rel, action] = name.split(':');
  const model = rel ? modelAt(rel) : 'Inquiry';
  return !!model && actionsOf(model).includes(action as string);
};

const unknownNames = (rule: ActionRule) => leafNames(rule).filter((name) => !isKnown(name));

describe('inquiryPermission', () => {
  it('declares parties for every inquiry type', () => {
    expect(Object.keys(INQUIRY_TYPES).sort()).toEqual(Object.values(InquiryType).sort());
  });

  it('names only relations, actions and fields the schema actually has, in every send, resolve and read rule', () => {
    const declared = Object.values(inquiryPermission(INQUIRY_TYPES).actions);

    expect(declared.flatMap(unknownNames)).toEqual([]);
    expect(declared.flatMap(leafNames)).toContain('sourceSpace.organization:own');
    expect(declared.flatMap(leafNames)).toContain('content.role');
  });

  it('reports a misspelt relation, action or field inside a rule-form level', () => {
    expect(
      unknownNames({
        any: [
          {
            all: [
              { rule: { field: 'content.role', operator: 'in', value: [] } },
              { rel: 'sourceOrganization', action: 'onw' },
            ],
          },
          { rel: 'sourceSpace.organisation', action: 'own' },
          { rule: { field: 'contnet.role', operator: 'equals', value: null } },
        ],
      }),
    ).toEqual(['sourceOrganization:onw', 'sourceSpace.organisation:own', 'contnet.role']);
  });

  it('gates each grant on the party model and asks the relation named for its side and model', () => {
    expect(inquiryPartyRule('source', { model: 'Organization', send: 'own' }, 'send')).toEqual({
      all: [
        { rule: { field: 'sourceModel', operator: 'equals', value: 'Organization' } },
        { rel: 'sourceOrganization', action: 'own' },
      ],
    });
  });

  it('uses a level written as a rule exactly as written', () => {
    expect(
      inquiryPartyRule(
        'source',
        { model: 'Space', send: { rel: 'sourceSpace.organization', action: 'own' } },
        'send',
      ),
    ).toEqual({
      all: [
        { rule: { field: 'sourceModel', operator: 'equals', value: 'Space' } },
        { rel: 'sourceSpace.organization', action: 'own' },
      ],
    });
  });

  it('grants nothing for the platform (superadmin) or for a verb the party does not declare', () => {
    expect(inquiryPartyRule('target', { model: 'admin' }, 'resolve')).toBeNull();
    expect(inquiryPartyRule('target', { model: 'User', resolve: 'manage' }, 'send')).toBeNull();
  });

  it('gates each send, resolve and read branch on its own type', () => {
    const { actions } = inquiryPermission(INQUIRY_TYPES);
    const gates = (rule: unknown) =>
      (rule as Gated).any.map(({ all: [gate] }) => [gate.rule.operator, gate.rule.value]);
    const expected = Object.keys(INQUIRY_TYPES).map((type) => ['equals', type]);

    expect(gates(actions.send)).toEqual(expected);
    expect(gates(actions.resolve)).toEqual(expected);
  });

  it('reads party-wide, whatever the type: the person on a side, or its organization or space with manage', () => {
    expect(inquiryPermission(INQUIRY_TYPES).actions.read).toEqual({
      any: [
        { rel: 'sourceUser', action: 'read' },
        { rel: 'sourceOrganization', action: 'manage' },
        { rel: 'sourceSpace', action: 'manage' },
        { rel: 'targetUser', action: 'read' },
        { rel: 'targetOrganization', action: 'manage' },
        { rel: 'targetSpace', action: 'manage' },
      ],
    });
  });

  it('is what the rebac schema serves for db:inquiry', () => {
    expect(rebacSchema.permissions['db:inquiry']).toEqual(inquiryPermission(INQUIRY_TYPES));
  });
});

describe('inquiryPermission through the real check, per inquiry type', () => {
  const organization = { id: 'o1' };
  const otherOrganization = { id: 'o2' };
  const space = { id: 's1', organizationId: organization.id, organization };

  type Seat = { organization?: Role; otherOrganization?: Role; space?: Role };

  const principal = async (seat: Seat, userId = 'u1') => {
    const permix = createPermissions();
    await installPermissions(
      permix,
      permissionsOfUser(
        userId,
        [
          ...(seat.organization
            ? [{ organizationId: organization.id, role: seat.organization }]
            : []),
          ...(seat.otherOrganization
            ? [{ organizationId: otherOrganization.id, role: seat.otherOrganization }]
            : []),
        ],
        seat.space ? [{ spaceId: space.id, role: seat.space }] : [],
      ),
    );
    permix.setActor({ model: ActorModel.User, record: { id: userId } });
    return permix;
  };

  const superadmin = async () => {
    const permix = createPermissions();
    permix.setSuperadmin(true);
    return permix;
  };

  const can = (permix: Permix, record: object, action: 'send' | 'resolve') =>
    check(permix, rebacSchema, 'inquiry', record as HydratedRecord, action);

  const invite = (role: Role | null) => ({
    type: 'inviteOrganizationUser',
    sourceModel: 'Organization',
    sourceOrganizationId: organization.id,
    sourceOrganization: organization,
    targetModel: 'User',
    targetUserId: 'u9',
    targetUser: { id: 'u9' },
    content: { role },
  });

  const createSpace = {
    type: 'createSpace',
    sourceModel: 'Organization',
    sourceOrganizationId: organization.id,
    sourceOrganization: organization,
    targetModel: 'admin',
  };

  const updateSpace = {
    type: 'updateSpace',
    sourceModel: 'Space',
    sourceSpaceId: space.id,
    sourceSpace: space,
    targetModel: 'admin',
  };

  const transferSpace = {
    type: 'transferSpace',
    sourceModel: 'Space',
    sourceSpaceId: space.id,
    sourceSpace: space,
    targetModel: 'Organization',
    targetOrganizationId: otherOrganization.id,
    targetOrganization: otherOrganization,
  };

  const roles = [...Object.values(Role), null];

  it('inviteOrganizationUser: an owner sends every role, an admin the low roles and none, a member nothing', async () => {
    const sendable = async (seat: Seat) => {
      const permix = await principal(seat);
      return roles.filter((role) => can(permix, invite(role), 'send'));
    };

    expect(await sendable({ organization: 'owner' })).toEqual(roles);
    expect(await sendable({ organization: 'admin' })).toEqual(['member', 'viewer', null]);
    expect(await sendable({ organization: 'member' })).toEqual([]);
    expect(await sendable({ otherOrganization: 'owner' })).toEqual([]);
  });

  it('inviteOrganizationUser: the invited user resolves, no one else in the organization does', async () => {
    expect(can(await principal({}, 'u9'), invite('member'), 'resolve')).toBe(true);
    expect(can(await principal({ organization: 'owner' }), invite('member'), 'resolve')).toBe(
      false,
    );
  });

  it("createSpace: the organization's owner sends, its admin does not", async () => {
    expect(can(await principal({ organization: 'owner' }), createSpace, 'send')).toBe(true);
    expect(can(await principal({ organization: 'admin' }), createSpace, 'send')).toBe(false);
    expect(can(await principal({ otherOrganization: 'owner' }), createSpace, 'send')).toBe(false);
  });

  it("updateSpace: the space's owner or its organization's owner sends, a space admin does not", async () => {
    expect(can(await principal({ space: 'owner' }), updateSpace, 'send')).toBe(true);
    expect(can(await principal({ organization: 'owner' }), updateSpace, 'send')).toBe(true);
    expect(can(await principal({ space: 'admin' }), updateSpace, 'send')).toBe(false);
    expect(can(await principal({ otherOrganization: 'owner' }), updateSpace, 'send')).toBe(false);
  });

  it("transferSpace: the owner of the space's organization sends, the target organization's owner resolves", async () => {
    expect(can(await principal({ organization: 'owner' }), transferSpace, 'send')).toBe(true);
    expect(can(await principal({ space: 'owner' }), transferSpace, 'send')).toBe(false);
    expect(can(await principal({ organization: 'admin' }), transferSpace, 'send')).toBe(false);
    expect(can(await principal({ otherOrganization: 'owner' }), transferSpace, 'send')).toBe(false);

    expect(can(await principal({ otherOrganization: 'owner' }), transferSpace, 'resolve')).toBe(
      true,
    );
    expect(can(await principal({ otherOrganization: 'admin' }), transferSpace, 'resolve')).toBe(
      false,
    );
    expect(can(await principal({ organization: 'owner' }), transferSpace, 'resolve')).toBe(false);
  });

  it('an inquiry targeting the platform (admin) is resolved by a superadmin only', async () => {
    for (const inquiry of [createSpace, updateSpace]) {
      expect(can(await superadmin(), inquiry, 'resolve')).toBe(true);
      expect(
        can(await principal({ organization: 'owner', space: 'owner' }), inquiry, 'resolve'),
      ).toBe(false);
    }
  });
});
