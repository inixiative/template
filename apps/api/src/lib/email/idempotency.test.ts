import { describe, expect, it } from 'bun:test';
import { deliverJobId, plannerJobId } from '#/lib/email/idempotency';

describe('email idempotency keys', () => {
  describe('plannerJobId', () => {
    it('is shaped event:template:hash', () => {
      const parts = plannerJobId('inquiry.sent', 'invite', { inquiryId: 'inq-1' }).split(':');
      expect(parts.slice(0, 2)).toEqual(['inquiry.sent', 'invite']);
      expect(parts.at(-1)).toMatch(/^[0-9a-f]{16}$/);
    });

    it('collapses re-emits of the same event (ref order independent)', () => {
      expect(plannerJobId('e', 't', { a: 1, b: 2 })).toBe(plannerJobId('e', 't', { b: 2, a: 1 }));
    });

    it('changes when the refs change', () => {
      expect(plannerJobId('e', 't', { inquiryId: '1' })).not.toBe(plannerJobId('e', 't', { inquiryId: '2' }));
    });
  });

  describe('deliverJobId', () => {
    it('shares the planner prefix and puts the content hash last', () => {
      const id = deliverJobId('inquiry.sent', 'invite', 'Organization:org-1', 'bob@x.com', { role: 'member' });
      const parts = id.split(':');
      expect(parts.slice(0, 2)).toEqual(['inquiry.sent', 'invite']);
      expect(parts.at(-1)).toMatch(/^[0-9a-f]{16}$/);
      expect(id.startsWith('inquiry.sent:invite:Organization:org-1:bob@x.com:')).toBe(true);
    });

    it('is stable for the same recipient + contents (content order independent)', () => {
      expect(deliverJobId('e', 't', 'default', 'bob@x.com', { x: 1, y: 2 })).toBe(
        deliverJobId('e', 't', 'default', 'bob@x.com', { y: 2, x: 1 }),
      );
    });

    it('differs per recipient', () => {
      expect(deliverJobId('e', 't', 'default', 'a@x.com', { x: 1 })).not.toBe(
        deliverJobId('e', 't', 'default', 'b@x.com', { x: 1 }),
      );
    });

    it('differs per sender context', () => {
      expect(deliverJobId('e', 't', 'Organization:org-1', 'bob@x.com', { x: 1 })).not.toBe(
        deliverJobId('e', 't', 'Space:space-1', 'bob@x.com', { x: 1 }),
      );
    });

    it('differs when the rendered contents change (allows a legitimate resend)', () => {
      expect(deliverJobId('e', 't', 'default', 'bob@x.com', { role: 'member' })).not.toBe(
        deliverJobId('e', 't', 'default', 'bob@x.com', { role: 'admin' }),
      );
    });
  });
});
