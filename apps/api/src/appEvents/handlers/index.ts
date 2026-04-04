import type { AppEventHandlerFn } from '#/appEvents/makeAppEvent';
import { inquiryResolved, type InquiryResolvedPayload } from '#/appEvents/handlers/inquiry/inquiryResolved';
import { inquirySent, type InquirySentPayload } from '#/appEvents/handlers/inquiry/inquirySent';
import { userCreated, type UserCreatedPayload } from '#/appEvents/handlers/user/userCreated';
import {
  userVerificationRequested,
  type UserVerificationRequestedPayload,
} from '#/appEvents/handlers/user/userVerificationRequested';

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

export const appEventHandlers: Record<AppEventName, AppEventHandlerFn> = {
  'inquiry.sent': inquirySent,
  'inquiry.resolved': inquiryResolved,
  'user.created': userCreated,
  'user.verificationRequested': userVerificationRequested,
};
