import { describe, expect, it } from 'bun:test';
import type { HydratedRecord } from '@template/db';
import {
  ActorModel,
  createPermissions,
  type PermissionEntry,
  personOnlyActions,
  SessionAction,
  UserAction,
} from '@template/permissions/client';
import { check } from '@template/permissions/rebac/check';
import { rebacSchema } from '@template/permissions/rebac/schema';

const o1 = { id: 'o1' };
const o9 = { id: 'o9' };
const u1 = { id: 'u1' };
const u2 = { id: 'u2' };
const uo = { id: 'uo' };
const ua = { id: 'ua' };

const relation = (
  id: string,
  user: { id: string },
  organization: { id: string },
  role: string,
) => ({
  id,
  role,
  userId: user.id,
  organizationId: organization.id,
  user,
  organization,
});
const r1 = relation('r1', u1, o1, 'member');
const r2 = relation('r2', u2, o1, 'member');
const r9 = relation('r9', u1, o9, 'member');

const tokenOf = (id: string, user: { id: string }) => ({ id, userId: user.id, user });

const inquiryTo = (target: { id: string }, source: { id: string }) => ({
  id: 'q1',
  type: 'inviteOrganizationUser',
  content: { role: 'member' },
  sourceUserId: source.id,
  sourceUser: source,
  sourceOrganizationId: 'o1',
  sourceOrganization: o1,
  targetUserId: target.id,
  targetUser: target,
});

const table = async (...entries: PermissionEntry[]) => {
  const permix = createPermissions();
  await permix.setup(entries);
  return permix;
};
const grant = (resource: string, id: string, action: string): PermissionEntry => ({
  resource,
  id,
  actions: { [action]: true },
});

const session = (user: { id: string }, orgAction: string) =>
  table(grant('db:user', user.id, 'own'), grant('db:organization', 'o1', orgAction));
const narrowedUserToken = (user: { id: string }, userAction: string) =>
  table(grant('db:user', user.id, userAction), grant('db:organization', 'o1', 'operate'));
const relationToken = (row: { organizationId: string }, action: string) =>
  table(grant('db:organization', row.organizationId, action));

const can = (
  permix: Awaited<ReturnType<typeof table>>,
  model: Parameters<typeof check>[2],
  record: object,
  action: string,
) => check(permix, rebacSchema, model, record as HydratedRecord, action);

const acting = (permix: Awaited<ReturnType<typeof table>>, model: ActorModel, id = 'who') => {
  permix.setActor({ id, model });
  return permix;
};

describe('no self arm: the person reaches their own rows through rel user (Aron, 2026-10-23)', () => {
  describe('the user and their relation', () => {
    it('the user leaves their own relation', async () => {
      expect(can(await session(u1, 'operate'), 'organizationUser', r1, 'leave')).toBe(true);
    });

    it('the user cannot evict a peer', async () => {
      const member = await session(u1, 'operate');
      expect(can(member, 'organizationUser', r2, 'leave')).toBe(false);
      expect(can(member, 'organization', { ...o1, role: 'member' }, 'assign')).toBe(false);
    });

    it('an admin evicts a member through the org, never through leave', async () => {
      const admin = await session(ua, 'manage');
      expect(can(admin, 'organization', { ...o1, role: 'member' }, 'assign')).toBe(true);
      expect(can(admin, 'organizationUser', r2, 'leave')).toBe(false);
    });

    it('an admin cannot evict an owner, an owner can', async () => {
      expect(
        can(await session(ua, 'manage'), 'organization', { ...o1, role: 'owner' }, 'assign'),
      ).toBe(false);
      expect(
        can(await session(uo, 'own'), 'organization', { ...o1, role: 'owner' }, 'assign'),
      ).toBe(true);
    });

    it('a member reads their own relation and every relation of their org', async () => {
      const member = await session(u1, 'operate');
      expect(can(member, 'organizationUser', r1, 'read')).toBe(true);
      expect(can(member, 'organizationUser', r2, 'read')).toBe(true);
      expect(can(member, 'organizationUser', r9, 'read')).toBe(true);
    });
  });

  describe('a credential narrowed on the user', () => {
    it('a read-only user token cannot leave, cannot delete a sibling token, cannot accept an invite', async () => {
      const token = await narrowedUserToken(u1, 'read');
      expect(can(token, 'organizationUser', r1, 'leave')).toBe(false);
      expect(can(token, 'token', tokenOf('t2', u1), 'leave')).toBe(false);
      expect(can(token, 'inquiry', inquiryTo(u1, u2), 'resolve')).toBe(false);
    });

    it('a user token holding operate on the user can do all three', async () => {
      const token = await narrowedUserToken(u1, 'operate');
      expect(can(token, 'organizationUser', r1, 'leave')).toBe(true);
      expect(can(token, 'token', tokenOf('t2', u1), 'leave')).toBe(true);
      expect(can(token, 'inquiry', inquiryTo(u1, u2), 'resolve')).toBe(true);
    });
  });

  describe("a relation's token holds nothing on the user", () => {
    it('cannot leave its relation, a peer, or the same user’s seat elsewhere', async () => {
      const token = await relationToken(r1, 'operate');
      expect(can(token, 'organizationUser', r1, 'leave')).toBe(false);
      expect(can(token, 'organizationUser', r2, 'leave')).toBe(false);
      expect(can(token, 'organizationUser', r9, 'leave')).toBe(false);
    });

    it("cannot delete the user's tokens or accept the user's invites", async () => {
      const token = await relationToken(r1, 'manage');
      expect(can(token, 'token', tokenOf('t2', u1), 'leave')).toBe(false);
      expect(can(token, 'inquiry', inquiryTo(u1, u2), 'resolve')).toBe(false);
    });
  });

  describe('inquiries', () => {
    it('the target user resolves, the source user reads, nobody else does either', async () => {
      const q = inquiryTo(u1, u2);
      expect(can(await session(u1, 'operate'), 'inquiry', q, 'resolve')).toBe(true);
      expect(can(await session(u2, 'operate'), 'inquiry', q, 'read')).toBe(true);
      const bystander = await table(grant('db:user', 'u3', 'own'));
      expect(can(bystander, 'inquiry', q, 'read')).toBe(false);
      expect(can(bystander, 'inquiry', q, 'resolve')).toBe(false);
    });
  });

  describe('acting on your own record', () => {
    it('your user, your relation, your token, your invite: all through rel user', async () => {
      const me = await session(u1, 'operate');
      expect(can(me, 'user', u1, 'own')).toBe(true);
      expect(can(me, 'organizationUser', r1, 'leave')).toBe(true);
      expect(can(me, 'token', tokenOf('t1', u1), 'leave')).toBe(true);
      expect(can(me, 'inquiry', inquiryTo(u1, u2), 'resolve')).toBe(true);
    });

    it('never someone else’s, however much you hold on your own org', async () => {
      const owner = await session(uo, 'own');
      expect(can(owner, 'user', u2, 'read')).toBe(false);
      expect(can(owner, 'organizationUser', r2, 'leave')).toBe(false);
      expect(can(owner, 'token', tokenOf('t2', u2), 'leave')).toBe(false);
      expect(can(owner, 'inquiry', inquiryTo(u2, u1), 'resolve')).toBe(false);
    });
  });

  describe('acting on what you are granted', () => {
    it('a member reads the org and its relations, operates, and does not manage', async () => {
      const member = await session(u1, 'operate');
      expect(can(member, 'organization', o1, 'read')).toBe(true);
      expect(can(member, 'organization', o1, 'operate')).toBe(true);
      expect(can(member, 'organization', o1, 'manage')).toBe(false);
      expect(can(member, 'organizationUser', r2, 'read')).toBe(true);
      expect(can(member, 'organizationUser', r2, 'manage')).toBe(false);
    });

    it('an admin manages the org and its relations, and does not own', async () => {
      const admin = await session(ua, 'manage');
      expect(can(admin, 'organizationUser', r2, 'manage')).toBe(true);
      expect(can(admin, 'organizationUser', r2, 'own')).toBe(false);
      expect(can(admin, 'organization', o1, 'own')).toBe(false);
    });

    it('a space grant reaches the space and its relations, not the org above it', async () => {
      const spaceViewer = await table(grant('db:space', 's1', 'read'));
      const s1 = { id: 's1', organizationId: 'o1', organization: o1 };
      const su2 = { id: 'su2', userId: 'u2', spaceId: 's1', user: u2, space: s1 };
      expect(can(spaceViewer, 'space', s1, 'read')).toBe(true);
      expect(can(spaceViewer, 'spaceUser', su2, 'read')).toBe(true);
      expect(can(spaceViewer, 'organization', o1, 'read')).toBe(false);
      expect(can(spaceViewer, 'organizationUser', r2, 'read')).toBe(false);
    });
  });

  describe('no bridging', () => {
    it('a grant on one org reaches nothing in another', async () => {
      const ownerOfO1 = await session(uo, 'own');
      const s9 = { id: 's9', organizationId: 'o9', organization: o9 };
      expect(can(ownerOfO1, 'organization', o9, 'read')).toBe(false);
      expect(can(ownerOfO1, 'organizationUser', r9, 'read')).toBe(false);
      expect(can(ownerOfO1, 'space', s9, 'read')).toBe(false);
    });

    it('a relation token in one org does not reach the same user elsewhere, nor the user', async () => {
      const token = await relationToken(r1, 'manage');
      expect(can(token, 'organizationUser', r1, 'manage')).toBe(true);
      expect(can(token, 'organizationUser', r9, 'read')).toBe(false);
      expect(can(token, 'user', u1, 'read')).toBe(false);
      expect(can(token, 'token', tokenOf('t1', u1), 'leave')).toBe(false);
    });

    it('a user grant does not bridge into the user’s orgs', async () => {
      const userOnly = await table(grant('db:user', 'u1', 'own'));
      expect(can(userOnly, 'organizationUser', r1, 'leave')).toBe(true);
      expect(can(userOnly, 'organization', o1, 'read')).toBe(false);
      expect(can(userOnly, 'organizationUser', r2, 'read')).toBe(false);
    });

    it('a record without the relation loaded is denied, never guessed from the key', async () => {
      const me = await session(u1, 'operate');
      const { user: _user, ...bare } = r1;
      expect(can(me, 'organizationUser', bare, 'leave')).toBe(false);
    });
  });

  describe('no bridging across siblings', () => {
    const s1 = { id: 's1', organizationId: 'o1', organization: o1 };
    const s2 = { id: 's2', organizationId: 'o1', organization: o1 };
    const integration = (id: string) => ({
      id,
      ownerModel: 'User',
      userId: 'u1',
      organizationId: null,
      spaceId: null,
      user: u1,
    });

    it('a grant on one relation reaches neither its sibling nor the org', async () => {
      const onR1 = await table(grant('db:organizationUser', 'r1', 'own'));
      expect(can(onR1, 'organizationUser', r1, 'own')).toBe(true);
      expect(can(onR1, 'organizationUser', r2, 'read')).toBe(false);
      expect(can(onR1, 'organization', o1, 'read')).toBe(false);
      expect(can(onR1, 'user', u1, 'read')).toBe(false);
    });

    it('a grant on one space reaches neither its sibling space nor the org', async () => {
      const onS1 = await table(grant('db:space', 's1', 'own'));
      expect(can(onS1, 'space', s1, 'own')).toBe(true);
      expect(can(onS1, 'space', s2, 'read')).toBe(false);
      expect(can(onS1, 'organization', o1, 'read')).toBe(false);
      expect(can(onS1, 'organizationUser', r1, 'read')).toBe(false);
    });

    it("a grant on one token reaches neither a sibling token nor the token's user", async () => {
      const onT1 = await table(grant('db:token', 't1', 'leave'));
      expect(can(onT1, 'token', tokenOf('t1', u1), 'leave')).toBe(true);
      expect(can(onT1, 'token', tokenOf('t2', u1), 'leave')).toBe(false);
      expect(can(onT1, 'user', u1, 'read')).toBe(false);
    });

    it('a grant on one integration reaches neither a sibling integration nor the owner', async () => {
      const onI1 = await table(grant('db:integration', 'i1', 'manage'));
      expect(can(onI1, 'integration', integration('i1'), 'manage')).toBe(true);
      expect(can(onI1, 'integration', integration('i2'), 'read')).toBe(false);
      expect(can(onI1, 'user', u1, 'read')).toBe(false);
    });
  });

  describe('the actor: who is acting, beside what they hold (Aron, 2026-10-23)', () => {
    it('a person holding operate on their user mints a token; a token holding own does not', async () => {
      const person = acting(await table(grant('db:user', 'u1', 'operate')), ActorModel.User, 'u1');
      expect(can(person, 'user', u1, SessionAction.createToken)).toBe(true);
      const token = acting(await table(grant('db:user', 'u1', 'own')), ActorModel.Token, 't1');
      expect(can(token, 'user', u1, SessionAction.createToken)).toBe(false);
    });

    it('every person-only action is refused to a token holding own on the user', async () => {
      const token = acting(await table(grant('db:user', 'u1', 'own')), ActorModel.Token, 't1');
      const person = acting(await table(grant('db:user', 'u1', 'own')), ActorModel.User, 'u1');
      for (const action of personOnlyActions) {
        expect(can(token, 'user', u1, action)).toBe(false);
        expect(can(person, 'user', u1, action)).toBe(true);
      }
    });

    it('redacting the account and deleting an organization take own; a member does neither', async () => {
      const member = acting(await table(grant('db:user', 'u1', 'operate')), ActorModel.User, 'u1');
      expect(can(member, 'user', u1, SessionAction.redactUser)).toBe(false);
      expect(can(member, 'user', u1, SessionAction.deleteOrganization)).toBe(false);
      expect(can(member, 'user', u1, SessionAction.rotateUserJwts)).toBe(true);
    });

    it('with nobody acting a person-only action denies; the table still answers the rest', async () => {
      const nobody = await table(grant('db:user', 'u1', 'own'));
      expect(can(nobody, 'user', u1, SessionAction.createToken)).toBe(false);
      expect(can(nobody, 'user', u1, 'own')).toBe(true);
    });

    it('identify and create-organization follow the table, not the actor', async () => {
      const readToken = acting(await table(grant('db:user', 'u1', 'read')), ActorModel.Token, 't1');
      expect(can(readToken, 'user', u1, UserAction.identify)).toBe(true);
      expect(can(readToken, 'user', u1, UserAction.createOrganization)).toBe(false);
      const memberToken = acting(
        await table(grant('db:user', 'u1', 'operate')),
        ActorModel.Token,
        't1',
      );
      expect(can(memberToken, 'user', u1, UserAction.createOrganization)).toBe(true);
    });

    it('a superadmin passes a person-only check on any credential', async () => {
      const token = acting(await table(), ActorModel.Token, 't1');
      token.setSuperadmin(true);
      expect(can(token, 'user', u1, SessionAction.createToken)).toBe(true);
    });
  });
});
