import { describe, expect, it } from 'bun:test';
import { AppEventName, appEventHandlers } from '#/appEvents/handlers';

describe('appEventHandlers', () => {
  it('has a handler for every AppEventName', () => {
    for (const name of Object.values(AppEventName)) {
      expect(appEventHandlers[name]).toBeDefined();
      expect(typeof appEventHandlers[name]).toBe('function');
    }
  });

  it('defines all expected events', () => {
    expect(AppEventName.inquirySent).toBe('inquiry.sent');
    expect(AppEventName.inquiryResolved).toBe('inquiry.resolved');
    expect(AppEventName.userCreated).toBe('user.created');
    expect(AppEventName.userVerificationRequested).toBe('user.verificationRequested');
  });

  it('has no extra handlers beyond AppEventName', () => {
    const names = Object.values(AppEventName);
    const handlerNames = Object.keys(appEventHandlers);
    expect(handlerNames.sort()).toEqual(names.sort());
  });
});
