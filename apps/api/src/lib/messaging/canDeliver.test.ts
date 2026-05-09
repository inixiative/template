import { describe, expect, it } from 'bun:test';
import { canDeliver } from '#/lib/messaging/canDeliver';

const contact = (acceptedKinds: string[]) => ({ acceptedKinds });
const ref = (acceptedKinds: string[]) => ({ acceptedKinds });

describe('canDeliver', () => {
  describe('system kind', () => {
    it('always delivers regardless of contact opt-ins', () => {
      expect(canDeliver('system', contact([]))).toBe(true);
      expect(canDeliver('system', contact(['platform']))).toBe(true);
    });

    it('always delivers even when customerRef does not list system', () => {
      expect(canDeliver('system', contact([]), ref([]))).toBe(true);
    });
  });

  describe('contact gate', () => {
    it('delivers when contact accepts the kind', () => {
      expect(canDeliver('platform', contact(['platform']))).toBe(true);
      expect(canDeliver('marketing', contact(['platform', 'marketing']))).toBe(true);
    });

    it('refuses when contact does not accept the kind', () => {
      expect(canDeliver('marketing', contact(['platform']))).toBe(false);
      expect(canDeliver('activity', contact([]))).toBe(false);
    });

    it('refuses when acceptedKinds is malformed (non-array)', () => {
      expect(canDeliver('platform', { acceptedKinds: null } as never)).toBe(false);
      expect(canDeliver('platform', { acceptedKinds: 'platform' } as never)).toBe(false);
    });
  });

  describe('customerRef gate', () => {
    it('passes when both contact and customerRef accept the kind', () => {
      expect(canDeliver('platform', contact(['platform']), ref(['platform']))).toBe(true);
    });

    it('refuses when contact accepts but customerRef does not', () => {
      expect(canDeliver('marketing', contact(['platform', 'marketing']), ref(['platform']))).toBe(false);
    });

    it('refuses when customerRef accepts but contact does not', () => {
      expect(canDeliver('marketing', contact(['platform']), ref(['platform', 'marketing']))).toBe(false);
    });

    it('skips the customerRef gate when not provided', () => {
      expect(canDeliver('platform', contact(['platform']))).toBe(true);
      expect(canDeliver('platform', contact(['platform']), null)).toBe(true);
    });
  });
});
