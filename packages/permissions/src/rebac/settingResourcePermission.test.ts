import { describe, expect, it } from 'bun:test';
import { fieldOf, relationTarget } from '@inixiative/field-map';
import type { Condition } from '@inixiative/json-rules';
import type { HydratedRecord } from '@template/db';
import { Role } from '@template/db/generated/client/enums';
import { prismaMap } from '@template/db/generated/prismaMap';
import {
  ActorModel,
  createPermissions,
  installPermissions,
  type Permix,
} from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';
import {
  settingResourceModelRule,
  settingResourcePermissionFromDefinitions,
} from '@template/permissions/rebac/settingResourcePermission';
import type { ActionRule, RebacSchema } from '@template/permissions/rebac/types';
import { permissionsOfUser } from '@template/permissions/roles/permissionsOfUser';
import { defineSetting, SETTING_DEFINITIONS } from '@template/shared/settings';
import { lowerFirst } from 'lodash-es';
import { z } from 'zod';

const modelAt = (path: string): string | undefined =>
  relationTarget(prismaMap, 'Setting', path) ?? undefined;

const actionsOf = (model: string) =>
  Object.keys(rebacSchema.permissions[`db:${lowerFirst(model)}`]?.actions ?? {});

const leaves = (condition: Condition): Condition[] => {
  if (typeof condition !== 'object') return [];
  if ('all' in condition) return condition.all.flatMap(leaves);
  if ('any' in condition) return condition.any.flatMap(leaves);
  return [condition];
};

const leafNames = (rule: ActionRule): string[] => {
  if (rule === null || typeof rule === 'boolean') return [];
  if (typeof rule === 'string') return [`:${rule}`];
  if ('any' in rule) return rule.any.flatMap(leafNames);
  if ('all' in rule) return rule.all.flatMap(leafNames);
  if ('arrayOperator' in rule) return [`${rule.rel}[]`];
  if ('rel' in rule) return [`${rule.rel}:${rule.action}`];
  return leaves(rule.rule as Condition).map((leaf) => (leaf as { field: string }).field);
};

const isKnown = (name: string) => {
  if (name.startsWith('actor:')) return true;
  if (!name.includes(':')) return fieldOf(prismaMap, 'Setting', name.split('.')[0]) !== undefined;
  const [rel, action] = name.split(':');
  const model = rel ? modelAt(rel) : 'Setting';
  return !!model && actionsOf(model).includes(action as string);
};

const unknownNames = (rule: ActionRule) => leafNames(rule).filter((name) => !isKnown(name));

const syntheticDefinitions = {
  ...SETTING_DEFINITIONS,
  'synthetic.ownOnly': defineSetting({
    key: 'synthetic.ownOnly',
    category: 'general',
    label: 'Owner Only',
    description: 'Synthetic owner-gated setting with admin-only read.',
    resourceModels: ['Organization'],
    valueType: 'boolean',
    schema: z.boolean(),
    defaultValue: false,
    order: 30,
    permission: 'own',
    readPermission: 'manage',
  }),
  'synthetic.operateSetting': defineSetting({
    key: 'synthetic.operateSetting',
    category: 'general',
    label: 'Operate Setting',
    description: 'Synthetic operate-gated setting.',
    resourceModels: ['Organization', 'Space', 'Project', 'Integration', 'ProjectIntegration'],
    valueType: 'boolean',
    schema: z.boolean(),
    defaultValue: false,
    order: 40,
    permission: 'operate',
  }),
};

const syntheticRebacSchema: RebacSchema = {
  ...rebacSchema,
  permissions: {
    ...rebacSchema.permissions,
    'db:setting': settingResourcePermissionFromDefinitions(syntheticDefinitions),
  },
};

describe('settingResourcePermissionFromDefinitions', () => {
  it('exposes exactly manage and read actions and serves them on db:setting', () => {
    const compiled = settingResourcePermissionFromDefinitions(SETTING_DEFINITIONS);
    expect(Object.keys(compiled.actions).sort()).toEqual(['manage', 'read']);
    expect(rebacSchema.permissions['db:setting']).toEqual(compiled);
  });

  it('names only relations, actions, and fields the schema actually has across starter and synthetic definitions (all 8 resourceModels)', () => {
    const declared = Object.values(
      settingResourcePermissionFromDefinitions(syntheticDefinitions).actions,
    );

    expect(declared.flatMap(unknownNames)).toEqual([]);
    expect(declared.flatMap(leafNames)).toContain('resourceOrganization:own');
    expect(declared.flatMap(leafNames)).toContain('resourceOrganizationUser:operate');
    expect(declared.flatMap(leafNames)).toContain('resourceProject:manage');
    expect(declared.flatMap(leafNames)).toContain('resourceIntegration:operate');
    expect(declared.flatMap(leafNames)).toContain('resourceProjectIntegration:operate');
  });

  it('gates each model branch on resourceModel and asks the relation named resource<Model>', () => {
    expect(settingResourceModelRule('Organization', 'own')).toEqual({
      all: [
        { rule: { field: 'resourceModel', operator: 'equals', value: 'Organization' } },
        { rel: 'resourceOrganization', action: 'own' },
      ],
    });
  });

  it('reports misspelt relations, actions, or fields (including invalid own on Project/ProjectIntegration)', () => {
    expect(
      unknownNames({
        any: [
          { rel: 'resourceOrganization', action: 'onw' },
          { rel: 'resourceProject', action: 'own' },
          { rel: 'resourceProjectIntegration', action: 'own' },
          { rule: { field: 'resorceModel', operator: 'equals', value: 'User' } },
        ],
      }),
    ).toEqual([
      'resourceOrganization:onw',
      'resourceProject:own',
      'resourceProjectIntegration:own',
      'resorceModel',
    ]);
  });
});

describe('settingResourcePermission & db:projectIntegration through the real check', () => {
  const u1 = { id: 'u1' };
  const u2 = { id: 'u2' };
  const organization = { id: 'o1' };
  const otherOrganization = { id: 'o2' };
  const space = { id: 's1', organizationId: organization.id, organization };
  const orgMember = {
    id: 'm1',
    organizationId: organization.id,
    userId: u1.id,
    organization,
    user: u1,
  };
  const spaceMember = {
    id: 'sm1',
    organizationId: organization.id,
    spaceId: space.id,
    userId: u1.id,
    organization,
    space,
    user: u1,
  };
  const orgProject = {
    id: 'p1',
    ownerModel: 'Organization',
    organizationId: organization.id,
    organization,
  };
  const memberProject = {
    id: 'p2',
    ownerModel: 'OrganizationUser',
    organizationId: organization.id,
    userId: u1.id,
    organizationUser: orgMember,
    organization,
    user: u1,
  };
  const orgIntegration = {
    id: 'i1',
    ownerModel: 'Organization',
    organizationId: organization.id,
    organization,
  };
  const projectIntegration = {
    id: 'pi1',
    projectId: orgProject.id,
    integrationId: orgIntegration.id,
    project: orgProject,
    integration: orgIntegration,
  };

  type Seat = { organization?: Role; otherOrganization?: Role; space?: Role };

  const principal = async (seat: Seat, userId = u1.id) => {
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

  const superadmin = () => {
    const permix = createPermissions();
    permix.setSuperadmin(true);
    return permix;
  };

  const can = (
    permix: Permix,
    record: object,
    action: 'manage' | 'read',
    schema: RebacSchema = rebacSchema,
  ) => check(permix, schema, 'setting', record as HydratedRecord, action);

  it('User settings: only the user reads and manages their own settings', async () => {
    const record = {
      key: 'general.defaultTimezone',
      resourceModel: 'User',
      resourceUserId: u1.id,
      resourceUser: u1,
    };
    const self = await principal({}, u1.id);
    const other = await principal({}, u2.id);

    expect(can(self, record, 'read')).toBe(true);
    expect(can(self, record, 'manage')).toBe(true);
    expect(can(other, record, 'read')).toBe(false);
    expect(can(other, record, 'manage')).toBe(false);
  });

  it('own-gated setting with restricted readPermission: owner manages, admin reads only, member neither', async () => {
    const record = {
      key: 'synthetic.ownOnly',
      resourceModel: 'Organization',
      resourceOrganizationId: organization.id,
      resourceOrganization: organization,
    };
    const owner = await principal({ organization: Role.owner }, u1.id);
    const admin = await principal({ organization: Role.admin }, u1.id);
    const member = await principal({ organization: Role.member }, u1.id);
    const outsider = await principal({ otherOrganization: Role.owner }, u2.id);

    expect(can(owner, record, 'manage', syntheticRebacSchema)).toBe(true);
    expect(can(owner, record, 'read', syntheticRebacSchema)).toBe(true);

    expect(can(admin, record, 'manage', syntheticRebacSchema)).toBe(false);
    expect(can(admin, record, 'read', syntheticRebacSchema)).toBe(true);

    expect(can(member, record, 'manage', syntheticRebacSchema)).toBe(false);
    expect(can(member, record, 'read', syntheticRebacSchema)).toBe(false);

    expect(can(outsider, record, 'manage', syntheticRebacSchema)).toBe(false);
    expect(can(outsider, record, 'read', syntheticRebacSchema)).toBe(false);
  });

  it('operate-gated setting across Organization, Integration, and ProjectIntegration: member manages, viewer reads only', async () => {
    const records = [
      {
        key: 'synthetic.operateSetting',
        resourceModel: 'Organization',
        resourceOrganizationId: organization.id,
        resourceOrganization: organization,
      },
      {
        key: 'synthetic.operateSetting',
        resourceModel: 'Integration',
        resourceIntegrationId: orgIntegration.id,
        resourceIntegration: orgIntegration,
      },
      {
        key: 'synthetic.operateSetting',
        resourceModel: 'ProjectIntegration',
        resourceProjectIntegrationId: projectIntegration.id,
        resourceProjectIntegration: projectIntegration,
      },
    ];
    const admin = await principal({ organization: Role.admin }, u1.id);
    const member = await principal({ organization: Role.member }, u1.id);
    const viewer = await principal({ organization: Role.viewer }, u1.id);
    const outsider = await principal({}, u2.id);

    for (const record of records) {
      expect(can(admin, record, 'manage', syntheticRebacSchema)).toBe(true);
      expect(can(member, record, 'manage', syntheticRebacSchema)).toBe(true);
      expect(can(member, record, 'read', syntheticRebacSchema)).toBe(true);
      expect(can(viewer, record, 'manage', syntheticRebacSchema)).toBe(false);
      expect(can(viewer, record, 'read', syntheticRebacSchema)).toBe(true);
      expect(can(outsider, record, 'read', syntheticRebacSchema)).toBe(false);
    }
  });

  it('Space settings delegate through resourceSpace (including org owner inheritance)', async () => {
    const record = {
      key: 'general.defaultTimezone',
      resourceModel: 'Space',
      resourceOrganizationId: organization.id,
      resourceSpaceId: space.id,
      resourceSpace: space,
    };
    const spaceAdmin = await principal({ space: Role.admin }, u1.id);
    const spaceMember = await principal({ space: Role.member }, u1.id);
    const orgOwner = await principal({ organization: Role.owner }, u2.id);
    const orgAdmin = await principal({ organization: Role.admin }, u2.id);

    expect(can(spaceAdmin, record, 'manage')).toBe(true);
    expect(can(spaceMember, record, 'read')).toBe(true);
    expect(can(spaceMember, record, 'manage')).toBe(false);
    expect(can(orgOwner, record, 'manage')).toBe(true);
    expect(can(orgAdmin, record, 'read')).toBe(false);
  });

  it('OrganizationUser & SpaceUser personal settings (general.displayLocale): private to the member themselves, while Organization uses manage/read', async () => {
    const orgMemberLocale = {
      key: 'general.displayLocale',
      resourceModel: 'OrganizationUser',
      resourceOrganizationId: organization.id,
      resourceUserId: u1.id,
      resourceOrganizationUser: orgMember,
    };
    const spaceMemberLocale = {
      key: 'general.displayLocale',
      resourceModel: 'SpaceUser',
      resourceOrganizationId: organization.id,
      resourceSpaceId: space.id,
      resourceUserId: u1.id,
      resourceSpaceUser: spaceMember,
    };

    const memberSelf = await principal({ organization: Role.member }, u1.id);
    const orgAdmin = await principal({ organization: Role.admin }, u2.id);
    const orgOwner = await principal({ organization: Role.owner }, u2.id);
    const orgViewer = await principal({ organization: Role.viewer }, 'u3');

    for (const record of [orgMemberLocale, spaceMemberLocale]) {
      expect(can(memberSelf, record, 'read')).toBe(true);
      expect(can(memberSelf, record, 'manage')).toBe(true);

      expect(can(orgAdmin, record, 'read')).toBe(false);
      expect(can(orgAdmin, record, 'manage')).toBe(false);

      expect(can(orgOwner, record, 'read')).toBe(false);
      expect(can(orgOwner, record, 'manage')).toBe(false);

      expect(can(orgViewer, record, 'read')).toBe(false);
      expect(can(orgViewer, record, 'manage')).toBe(false);
    }

    const orgLocale = {
      key: 'general.displayLocale',
      resourceModel: 'Organization',
      resourceOrganizationId: organization.id,
      resourceOrganization: organization,
    };
    expect(can(orgAdmin, orgLocale, 'manage')).toBe(true);
    expect(can(orgViewer, orgLocale, 'read')).toBe(true);
    expect(can(orgViewer, orgLocale, 'manage')).toBe(false);
  });

  it('Project settings delegate through resourceProject for both org-owned and member-owned projects', async () => {
    const orgProjectRecord = {
      key: 'general.defaultTimezone',
      resourceModel: 'Project',
      resourceProjectId: orgProject.id,
      resourceProject: orgProject,
    };
    const memberProjectRecord = {
      key: 'general.defaultTimezone',
      resourceModel: 'Project',
      resourceProjectId: memberProject.id,
      resourceProject: memberProject,
    };

    const orgAdmin = await principal({ organization: Role.admin }, u2.id);
    const orgMemberUser = await principal({ organization: Role.member }, u1.id);

    expect(can(orgAdmin, orgProjectRecord, 'manage')).toBe(true);
    expect(can(orgMemberUser, orgProjectRecord, 'read')).toBe(true);
    expect(can(orgMemberUser, orgProjectRecord, 'manage')).toBe(false);

    expect(can(orgMemberUser, memberProjectRecord, 'manage')).toBe(true);
    expect(can(orgAdmin, memberProjectRecord, 'read')).toBe(false);
    expect(can(orgAdmin, memberProjectRecord, 'manage')).toBe(false);
  });

  it('db:projectIntegration enforces project:manage + integration:operate on create and project|integration:manage on delete', async () => {
    const orgAdmin = await principal({ organization: Role.admin }, u2.id);
    const orgMemberUser = await principal({ organization: Role.member }, u1.id);
    const orgViewer = await principal({ organization: Role.viewer }, 'u3');

    const checkPI = (permix: Permix, action: string, rec: object = projectIntegration) =>
      check(permix, rebacSchema, 'projectIntegration', rec as HydratedRecord, action);

    expect(checkPI(orgAdmin, 'create')).toBe(true);
    expect(checkPI(orgAdmin, 'manage')).toBe(true);
    expect(checkPI(orgAdmin, 'delete')).toBe(true);

    expect(checkPI(orgMemberUser, 'create')).toBe(false);
    expect(checkPI(orgMemberUser, 'manage')).toBe(false);
    expect(checkPI(orgMemberUser, 'operate')).toBe(true);
    expect(checkPI(orgMemberUser, 'read')).toBe(true);
    expect(checkPI(orgMemberUser, 'delete')).toBe(false);

    expect(checkPI(orgViewer, 'read')).toBe(true);
    expect(checkPI(orgViewer, 'operate')).toBe(false);

    // Member owns memberProject and operates orgIntegration -> can create & manage link,
    // and orgAdmin (who manages orgIntegration) can also delete the link!
    const memberProjectLink = {
      id: 'pi2',
      projectId: memberProject.id,
      integrationId: orgIntegration.id,
      project: memberProject,
      integration: orgIntegration,
    };
    expect(checkPI(orgMemberUser, 'create', memberProjectLink)).toBe(true);
    expect(checkPI(orgAdmin, 'manage', memberProjectLink)).toBe(false);
    expect(checkPI(orgAdmin, 'delete', memberProjectLink)).toBe(true);
  });

  it('unknown/retired keys fail closed for regular users and pass only for superadmin', async () => {
    const retired = {
      key: 'retired.legacyKey',
      resourceModel: 'Organization',
      resourceOrganizationId: organization.id,
      resourceOrganization: organization,
    };
    const owner = await principal({ organization: Role.owner }, u1.id);

    expect(can(owner, retired, 'read')).toBe(false);
    expect(can(owner, retired, 'manage')).toBe(false);
    expect(can(superadmin(), retired, 'read')).toBe(true);
    expect(can(superadmin(), retired, 'manage')).toBe(true);
  });
});
