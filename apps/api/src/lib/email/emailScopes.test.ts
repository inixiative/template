import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  type Condition,
  executePrismaPlan,
  toPrisma,
  toSourceQueries,
} from '@inixiative/json-rules';
import { db, sourceQueryValues } from '@template/db';
import { lensFor } from '@template/db/lens';
import {
  cleanupTouchedTables,
  createOrganization,
  createSegment,
  createSpace,
  createSpaceUser,
  createTag,
  createTagCategory,
} from '@template/db/test';
import { emailSlotLenses, scopeEmailLens } from '@template/email/rules';
import type { EmailLensOwner } from '@template/email/rules/scopeEmailLens';

type Tenant = { org: string; space: string; user: string; tag: string; segment: string };
type Reach = {
  organizations: string[];
  spaces: string[];
  tags: string[];
  segments: string[];
  senderOrganizations: string[];
  membersOfAnyOrganization: string[];
};

const tenants: Record<'A' | 'B', Tenant> = {} as never;
const labels = new Map<string, string>();
let platformTag = '';

const createTenant = async (name: 'A' | 'B'): Promise<void> => {
  const { entity: organization } = await createOrganization();
  const { entity: space } = await createSpace({}, { organization });
  const { entity: spaceUser } = await createSpaceUser({}, { organization, space });
  const tagCategory = (await createTagCategory({ ownerModel: 'Organization' }, { organization }))
    .entity;
  const { entity: tag } = await createTag(
    { ownerModel: 'Organization' },
    { organization, tagCategory },
  );
  const { entity: segment } = await createSegment({ ownerModel: 'Organization' }, { organization });
  tenants[name] = {
    org: organization.id,
    space: space.id,
    user: spaceUser.userId,
    tag: tag.id,
    segment: segment.id,
  };
  for (const [kind, id] of Object.entries(tenants[name])) labels.set(id, `${name}.${kind}`);
};

beforeAll(async () => {
  await createTenant('A');
  await createTenant('B');
  platformTag = (await createTag()).entity.id;
  labels.set(platformTag, 'platform.tag');
});

afterAll(async () => {
  await cleanupTouchedTables(db);
});

const named = (ids: unknown[]): string[] =>
  ids.flatMap((id) => labels.get(String(id)) ?? []).sort();

const owners = (name: 'A' | 'B'): Record<string, EmailLensOwner> => ({
  Organization: { ownerModel: 'Organization', ownerId: tenants[name].org },
  Space: { ownerModel: 'Space', ownerId: tenants[name].space, organizationId: tenants[name].org },
  User: { ownerModel: 'User', ownerId: tenants[name].user },
});

const reachOf = async (owner: EmailLensOwner, sender: EmailLensOwner): Promise<Reach> => {
  const lens = scopeEmailLens({ sender: lensFor('Organization') }, owner, sender);
  const options: Record<string, string[]> = {};
  for (const [root, slot] of emailSlotLenses(lens))
    for (const query of toSourceQueries(slot)) {
      const { options: found } = await sourceQueryValues(query, { lens: slot });
      options[`${root}:${query.model}`] = named(found.map((option) => option.value));
    }
  const anyOrganization = {
    field: 'organizationUsers',
    arrayOperator: 'any',
    condition: {
      field: 'organization.id',
      operator: 'in',
      value: [tenants.A.org, tenants.B.org],
    },
  } as Condition;
  const where = await executePrismaPlan(
    toPrisma(anyOrganization, { lens: lens.recipient as never }),
    db as never,
  );
  const members = await db.user.findMany({ where: where as never, select: { id: true } });
  return {
    organizations: options['recipient:Organization'] ?? [],
    spaces: options['recipient:Space'] ?? [],
    tags: options['recipient:Tag'] ?? [],
    segments: options['recipient:Segment'] ?? [],
    senderOrganizations: options['sender:Organization'] ?? [],
    membersOfAnyOrganization: named(members.map((member) => member.id)),
  };
};

const reach = (
  organizations: string[],
  spaces: string[],
  tags: string[],
  segments: string[],
  membersOfAnyOrganization: string[],
): Reach => ({
  organizations,
  spaces,
  tags,
  segments,
  senderOrganizations: organizations,
  membersOfAnyOrganization,
});

const ORGANIZATION_OWNER = reach(
  ['A.org'],
  ['A.space'],
  ['A.tag', 'platform.tag'],
  ['A.segment'],
  ['A.user'],
);
const SPACE_OWNER = reach(['A.org'], ['A.space'], ['platform.tag'], [], ['A.user']);
const USER_OWNER = reach([], [], ['platform.tag'], [], []);
const withoutMembers = (expected: Reach): Reach => ({ ...expected, membersOfAnyOrganization: [] });

describe('email scopes reach what the owner and sender may see', () => {
  const tenantCases: [string, string, Reach][] = [
    ['Organization', 'Organization', ORGANIZATION_OWNER],
    ['Organization', 'Space', ORGANIZATION_OWNER],
    ['Organization', 'User', withoutMembers(ORGANIZATION_OWNER)],
    ['Space', 'Organization', SPACE_OWNER],
    ['Space', 'Space', SPACE_OWNER],
    ['Space', 'User', withoutMembers(SPACE_OWNER)],
    ['User', 'Organization', USER_OWNER],
    ['User', 'Space', USER_OWNER],
    ['User', 'User', USER_OWNER],
  ];

  for (const [ownerKind, senderKind, expected] of tenantCases)
    it(`a ${ownerKind} owner with a ${senderKind} sender`, async () => {
      expect(await reachOf(owners('A')[ownerKind]!, owners('A')[senderKind]!)).toEqual(expected);
    });

  it('a platform owner with a platform sender reaches every tenant', async () => {
    expect(await reachOf(null, null)).toEqual(
      reach(['A.org', 'B.org'], ['A.space', 'B.space'], ['platform.tag'], [], ['A.user', 'B.user']),
    );
  });

  for (const senderKind of ['Organization', 'Space'])
    it(`a platform owner with a ${senderKind} sender reaches every tenant's rows but only the sender's members`, async () => {
      expect(await reachOf(null, owners('A')[senderKind]!)).toEqual(
        reach(['A.org', 'B.org'], ['A.space', 'B.space'], ['platform.tag'], [], ['A.user']),
      );
    });

  it('a platform owner with a User sender reaches no members', async () => {
    expect(await reachOf(null, owners('A').User!)).toEqual(
      reach(['A.org', 'B.org'], ['A.space', 'B.space'], ['platform.tag'], [], []),
    );
  });

  it('an owner with no sender scopes its own rows and leaves members to them', async () => {
    expect(await reachOf(owners('A').Organization!, null)).toEqual(ORGANIZATION_OWNER);
  });

  it("an organization's lens reaches none of another tenant's rows, even sent by that tenant", async () => {
    const crossed = await reachOf(owners('A').Organization!, owners('B').Organization!);
    expect(crossed).toEqual(withoutMembers(ORGANIZATION_OWNER));
    expect(JSON.stringify(crossed)).not.toContain('B.');
  });
});
