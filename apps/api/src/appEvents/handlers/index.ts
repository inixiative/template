import { type InquiryResolvedPayload, inquiryResolved } from '#/appEvents/handlers/inquiry/inquiryResolved';
import { type InquirySentPayload, inquirySent } from '#/appEvents/handlers/inquiry/inquirySent';
import { type UserCreatedPayload, userCreated } from '#/appEvents/handlers/user/userCreated';
import {
  type UserVerificationRequestedPayload,
  userVerificationRequested,
} from '#/appEvents/handlers/user/userVerificationRequested';
import type { AppEventHandlerFn } from '#/appEvents/makeAppEvent';

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
