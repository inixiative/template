import { afterAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { db } from '@template/db';
import {
  cleanupTouchedTables,
  createOrganization,
  createOrganizationUser,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { OPAQUE_SLOT } from '@template/email/rules';
import type { RuleLens } from '@template/shared/rules';
import { emailLensFor } from '#/lib/email/emailLensFor';
import type { Sender } from '#/lib/email/sender';
import { ownerScope } from '#/lib/emailTemplate';
import { resolveUsers } from '#/lib/messaging/resolveUsers';
import { targetedBySender } from '#/lib/messaging/senderTargeting';

const widened = {
  recipient: {
    picks: ['id', 'name', 'email'],
    relations: {
      organizationUsers: {
        picks: ['role'],
        relations: { organization: { picks: ['id', 'name'] } },
      },
      spaceUsers: { picks: ['role'], relations: { space: { picks: ['id', 'name'] } } },
    },
  },
};

const tree = async () => {
  const { entity: organization } = await createOrganization({ name: 'Home Org' });
  const { entity: elsewhere } = await createOrganization({ name: 'Elsewhere Org' });
  const { entity: space } = await createSpace({ name: 'Home Space' }, { organization });
  const { entity: sibling } = await createSpace({ name: 'Sibling Space' }, { organization });
  const { entity: foreign } = await createSpace(
    { name: 'Foreign Space' },
    { organization: elsewhere },
  );

  const inSpace = async (target: typeof space, org: typeof organization) => {
    const { entity: user } = await createUser();
    const { entity: organizationUser } = await createOrganizationUser(
      { role: 'member' },
      { user, organization: org },
    );
    await createSpaceUser(
      { role: 'viewer' },
      { user, organization: org, space: target, organizationUser },
    );
    return user;
  };
  const spaceMember = await inSpace(space, organization);
  const siblingMember = await inSpace(sibling, organization);
  const foreignMember = await inSpace(foreign, elsewhere);
  const { entity: orgOnly } = await createUser();
  await createOrganizationUser({ role: 'admin' }, { user: orgOnly, organization });
  const { entity: stranger } = await createUser();

  const everyone = [spaceMember, siblingMember, foreignMember, orgOnly, stranger];
  const sender: Sender = { type: 'Space', spaceId: space.id, organizationId: organization.id };
  return { sender, organization, everyone, spaceMember, siblingMember, orgOnly };
};

const targeted = async (sender: Sender, ids: string[], stored?: unknown) => {
  const lens = emailLensFor('sender-targeting', ownerScope(sender), stored, sender);
  const recipient = lens.recipient as RuleLens;
  expect(recipient).not.toBe(OPAQUE_SLOT);
  const rule = { field: 'id', operator: Operator.in, value: ids };
  const users = await resolveUsers(targetedBySender(rule, recipient, sender), recipient);
  return users.map((user) => user.id).sort();
};

afterAll(async () => {
  await cleanupTouchedTables(db);
});

describe('a sender targets within its own tree, as wide as its lens', () => {
  it('a space sender with the default lens reaches only its own space', async () => {
    const { sender, everyone, spaceMember } = await tree();
    expect(
      await targeted(
        sender,
        everyone.map((user) => user.id),
      ),
    ).toEqual([spaceMember.id]);
  });

  it("a space sender whose lens widens to the organization reaches sibling spaces and the organization's members, never another organization's", async () => {
    const { sender, everyone, spaceMember, siblingMember, orgOnly } = await tree();
    expect(
      await targeted(
        sender,
        everyone.map((user) => user.id),
        widened,
      ),
    ).toEqual([spaceMember.id, siblingMember.id, orgOnly.id].sort());
  });

  it("an organization sender with the default lens reaches its organization's members", async () => {
    const { organization, everyone, spaceMember, siblingMember, orgOnly } = await tree();
    const sender: Sender = { type: 'Organization', organizationId: organization.id };
    expect(
      await targeted(
        sender,
        everyone.map((user) => user.id),
      ),
    ).toEqual([spaceMember.id, siblingMember.id, orgOnly.id].sort());
  });
});
