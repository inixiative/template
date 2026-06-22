import { describe, expect, it } from 'bun:test';
import { inviteOrganizationUserAppEvents } from '#/modules/inquiry/handlers/inviteOrganizationUser/appEvents';

const makeInquiry = (overrides = {}) => ({
  id: 'inq-1',
  type: 'inviteOrganizationUser' as const,
  status: 'sent' as const,
  content: { role: 'member' },
  sourceUserId: 'user-source',
  sourceOrganizationId: 'org-1',
  sourceSpaceId: null,
  sourceModel: 'Organization' as const,
  targetUserId: 'user-target',
  targetOrganizationId: null,
  targetSpaceId: null,
  targetModel: 'User' as const,
  sourceUser: { id: 'user-source', name: 'Alice', email: 'alice@example.com' },
  sourceOrganization: { id: 'org-1', name: 'Acme Corp' },
  sourceSpace: null,
  targetUser: { id: 'user-target', name: 'Bob', email: 'bob@example.com' },
  targetOrganization: null,
  targetSpace: null,
  auditLogsAsSubject: [],
  resolution: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  sentAt: new Date(),
  expiresAt: null,
  ...overrides,
});

describe('inviteOrganizationUserAppEvents', () => {
  describe('sent.email', () => {
    it('returns invitation email handoff', () => {
      const inquiry = makeInquiry();
      const handoffs = inviteOrganizationUserAppEvents.sent!.email!(inquiry as never);

      expect(handoffs).toHaveLength(1);
      expect(handoffs![0].template).toBe('inquiry-invite-organization-user');
      expect(handoffs![0].data.inquiryId).toBe('inq-1');
    });

    it('returns null when no targetUserId', () => {
      const inquiry = makeInquiry({ targetUserId: null });
      const handoffs = inviteOrganizationUserAppEvents.sent!.email!(inquiry as never);
      expect(handoffs).toBeNull();
    });
  });

  describe('sent.websocket', () => {
    it('refetches the inquiry the send touched', () => {
      const events = inviteOrganizationUserAppEvents.sent!.websocket!(makeInquiry() as never);
      expect(events).toEqual([
        { category: 'query', action: 'refetch', key: { _id: 'inquiryRead', path: { id: 'inq-1' } } },
      ]);
    });
  });

  describe('resolved.websocket', () => {
    it('refetches the inquiry the resolution touched', () => {
      const events = inviteOrganizationUserAppEvents.resolved!.websocket!(makeInquiry() as never);
      expect(events).toEqual([
        { category: 'query', action: 'refetch', key: { _id: 'inquiryRead', path: { id: 'inq-1' } } },
      ]);
    });
  });
});
