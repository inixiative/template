// Handler registrations (side-effect imports — registers bridges via makeAppEvent)
import '#/appEvents/handlers/inquiry/inquiryResolved';
import '#/appEvents/handlers/inquiry/inquirySent';
import '#/appEvents/handlers/user/userCreated';
import '#/appEvents/handlers/user/userVerificationRequested';

// Re-export payload types for the central map
export type { InquiryResolvedPayload } from '#/appEvents/handlers/inquiry/inquiryResolved';
export type { InquirySentPayload } from '#/appEvents/handlers/inquiry/inquirySent';
export type { UserCreatedPayload } from '#/appEvents/handlers/user/userCreated';
export type { UserVerificationRequestedPayload } from '#/appEvents/handlers/user/userVerificationRequested';

export type AppEventPayloads = {
  'inquiry.sent': InquirySentPayload;
  'inquiry.resolved': InquiryResolvedPayload;
  'user.created': UserCreatedPayload;
  'user.verificationRequested': UserVerificationRequestedPayload;
};

export const AppEventName = {
  inquirySent: 'inquiry.sent',
  inquiryResolved: 'inquiry.resolved',
  userCreated: 'user.created',
  userVerificationRequested: 'user.verificationRequested',
} as const;

export type AppEventName = (typeof AppEventName)[keyof typeof AppEventName];
