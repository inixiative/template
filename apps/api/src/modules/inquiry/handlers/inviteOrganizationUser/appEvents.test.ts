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
      expect(handoffs![0].template).toBe('org-invitation');
      expect(handoffs![0].to).toEqual([{ userIds: ['user-target'] }]);
      expect(handoffs![0].data.organizationName).toBe('Acme Corp');
      expect(handoffs![0].data.inviterName).toBe('Alice');
      expect(handoffs![0].data.role).toBe('member');
      expect(handoffs![0].data.buttonUrl).toContain('/invitations/inq-1');
      expect(handoffs![0].data.buttonText).toBe('Accept Invitation');
      expect(handoffs![0].tags).toEqual(['inviteOrganizationUser']);
    });

    it('returns null when no targetUserId', () => {
      const inquiry = makeInquiry({ targetUserId: null });
      const handoffs = inviteOrganizationUserAppEvents.sent!.email!(inquiry as never);
      expect(handoffs).toBeNull();
    });

    it('sets org sender context', () => {
      const inquiry = makeInquiry();
      const handoffs = inviteOrganizationUserAppEvents.sent!.email!(inquiry as never);

      expect(handoffs![0].sender).toEqual({
        ownerModel: 'Organization',
        organizationId: 'org-1',
      });
    });
  });

  describe('sent.websocket', () => {
    it('returns WS handoff targeting the invited user', () => {
      const inquiry = makeInquiry();
      const handoffs = inviteOrganizationUserAppEvents.sent!.websocket!(inquiry as never);

      expect(handoffs).toHaveLength(1);
      expect(handoffs![0].target).toEqual({ userIds: ['user-target'] });
      expect(handoffs![0].message.data.event).toBe('inquiry.sent');
      expect(handoffs![0].message.data.inquiryId).toBe('inq-1');
    });

    it('returns null when no targetUserId', () => {
      const inquiry = makeInquiry({ targetUserId: null });
      const handoffs = inviteOrganizationUserAppEvents.sent!.websocket!(inquiry as never);
      expect(handoffs).toBeNull();
    });
  });

  describe('resolved.websocket', () => {
    it('targets both source and target users', () => {
      const inquiry = makeInquiry();
      const handoffs = inviteOrganizationUserAppEvents.resolved!.websocket!(inquiry as never);

      expect(handoffs).toHaveLength(1);
      expect(handoffs![0].target).toEqual({ userIds: ['user-source', 'user-target'] });
      expect(handoffs![0].message.data.event).toBe('inquiry.resolved');
    });

    it('returns null when no source or target user', () => {
      const inquiry = makeInquiry({ sourceUserId: null, targetUserId: null });
      const handoffs = inviteOrganizationUserAppEvents.resolved!.websocket!(inquiry as never);
      expect(handoffs).toBeNull();
    });
  });
});
