import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Contact, Organization, OrganizationUser, User } from '@template/db';
import { cleanupTouchedTables, createContact, createOrganizationUser, createUser, getNextSeq } from '@template/db/test';
import { contactRouter } from '#/modules/contact';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { del, get, json, patch, post } from '#tests/utils/request';

describe('Contact CRUD', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;
  let org: Organization;
  let orgUser: OrganizationUser;

  beforeAll(async () => {
    const { entity, context } = await createOrganizationUser({ role: 'admin' });
    orgUser = entity;
    user = context.user;
    org = context.organization;

    const harness = createTestApp({
      mockUser: user,
      mockOrganizationUsers: [orgUser],
      mount: [
        (app) => app.route('/api/v1/contact', contactRouter),
        (app) => app.route('/api/v1/me', meRouter),
      ],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  // helpers
  const e164 = () => `+1555${String(getNextSeq()).padStart(7, '0').slice(-7)}`;

  describe('POST /me/contacts', () => {
    it('creates a phone contact owned by the current user', async () => {
      const response = await fetch(
        post('/api/v1/me/contacts', {
          type: 'phone',
          value: { e164: e164(), country: 'US' },
        }),
      );
      const { data } = await json<Contact>(response);

      expect(response.status).toBe(201);
      expect(data.userId).toBe(user.id);
      expect(data.ownerModel).toBe('User');
      expect(data.valueKey).toMatch(/^\+1555/);
    });

    it('creates a linkedin contact, normalizing a pasted URL', async () => {
      const handle = `aron${getNextSeq()}`;
      const response = await fetch(
        post('/api/v1/me/contacts', {
          type: 'linkedin',
          value: { url: `https://linkedin.com/in/${handle}` },
        }),
      );
      const { data } = await json<Contact>(response);

      expect(response.status).toBe(201);
      expect(data.value).toEqual({ classifier: 'personal', handle });
      expect(data.valueKey).toBe(`personal:${handle.toLowerCase()}`);
    });

    it('rejects invalid phone country code (422 via hook)', async () => {
      const response = await fetch(
        post('/api/v1/me/contacts', {
          type: 'phone',
          value: { e164: e164(), country: 'ZZ' },
        }),
      );
      expect(response.status).toBe(422);
    });

    it('allows two users to claim the same linkedin handle (per-owner uniqueness)', async () => {
      const handle = `coowned${getNextSeq()}`;
      const first = await fetch(
        post('/api/v1/me/contacts', {
          type: 'linkedin',
          value: { classifier: 'personal', handle },
        }),
      );
      expect(first.status).toBe(201);

      // Different user, same handle — allowed under per-owner uniqueness.
      const { entity: otherUser } = await createUser();
      const otherHarness = createTestApp({
        mockUser: otherUser,
        mount: [(app) => app.route('/api/v1/me', meRouter)],
      });
      const second = await otherHarness.fetch(
        post('/api/v1/me/contacts', {
          type: 'linkedin',
          value: { classifier: 'personal', handle },
        }),
      );
      expect(second.status).toBe(201);
    });

    it('rejects same handle on the same owner (per-owner @@unique)', async () => {
      const handle = `dup${getNextSeq()}`;
      const first = await fetch(
        post('/api/v1/me/contacts', {
          type: 'linkedin',
          value: { classifier: 'personal', handle },
        }),
      );
      expect(first.status).toBe(201);
      const second = await fetch(
        post('/api/v1/me/contacts', {
          type: 'linkedin',
          value: { classifier: 'personal', handle },
        }),
      );
      // Prisma P2002 surfaces as a non-2xx via the error middleware
      expect(second.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /contact/:id', () => {
    it('reads own contact', async () => {
      const { entity: contact } = await createContact({
        user,
        ownerModel: 'User',
        type: 'email',
        value: { address: `read${getNextSeq()}@example.com` },
      });
      const response = await fetch(get(`/api/v1/contact/${contact.id}`));
      const { data } = await json<Contact>(response);
      expect(response.status).toBe(200);
      expect(data.id).toBe(contact.id);
    });

    it('rejects reading another user contact (403)', async () => {
      const { entity: otherUser } = await createUser();
      const { entity: contact } = await createContact({
        user: otherUser,
        ownerModel: 'User',
        type: 'email',
        value: { address: `priv${getNextSeq()}@example.com` },
      });
      const response = await fetch(get(`/api/v1/contact/${contact.id}`));
      expect(response.status).toBe(403);
    });

    // Note: per-row `permissionRules` is shipped on Contact + rebac check
    // additively merges it. Wiring it into Contact reads (so a non-owner can
    // be granted by the row rule) is a follow-up — `validateOwnerPermission`
    // currently only traverses to the owner. Tests for permissionRules merge
    // semantics live in `packages/permissions/src/rebac/check.test.ts`.

    it('reads org contact as org member', async () => {
      const { entity: contact } = await createContact({
        organization: org,
        ownerModel: 'Organization',
        type: 'email',
        value: { address: `orgmail${getNextSeq()}@example.com` },
      });
      const response = await fetch(get(`/api/v1/contact/${contact.id}`));
      expect(response.status).toBe(200);
    });
  });

  describe('PATCH /contact/:id', () => {
    it('updates own contact label + isPrimary', async () => {
      const { entity: contact } = await createContact({
        user,
        ownerModel: 'User',
        type: 'email',
        value: { address: `upd${getNextSeq()}@example.com` },
      });
      const response = await fetch(patch(`/api/v1/contact/${contact.id}`, { label: 'Work', isPrimary: true }));
      const { data } = await json<Contact>(response);
      expect(response.status).toBe(200);
      expect(data.label).toBe('Work');
      expect(data.isPrimary).toBe(true);
    });

    it('rejects updating another user contact (403)', async () => {
      const { entity: otherUser } = await createUser();
      const { entity: contact } = await createContact({
        user: otherUser,
        ownerModel: 'User',
        type: 'email',
        value: { address: `noupd${getNextSeq()}@example.com` },
      });
      const response = await fetch(patch(`/api/v1/contact/${contact.id}`, { label: 'Hacked' }));
      expect(response.status).toBe(403);
    });

  });

  describe('DELETE /contact/:id', () => {
    it('deletes own contact', async () => {
      const { entity: contact } = await createContact({
        user,
        ownerModel: 'User',
        type: 'email',
        value: { address: `del${getNextSeq()}@example.com` },
      });
      const response = await fetch(del(`/api/v1/contact/${contact.id}`));
      expect(response.status).toBe(204);
    });

    it('rejects deleting another user contact (403)', async () => {
      const { entity: otherUser } = await createUser();
      const { entity: contact } = await createContact({
        user: otherUser,
        ownerModel: 'User',
        type: 'email',
        value: { address: `nodel${getNextSeq()}@example.com` },
      });
      const response = await fetch(del(`/api/v1/contact/${contact.id}`));
      expect(response.status).toBe(403);
    });
  });
});
