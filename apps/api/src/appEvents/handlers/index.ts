import {
  type CommunicationSettledPayload,
  communicationSettled,
} from '#/appEvents/handlers/communication/communicationSettled';
import { type ContactCreatedPayload, contactCreated } from '#/appEvents/handlers/contact/contactCreated';
import { type ContactDeletedPayload, contactDeleted } from '#/appEvents/handlers/contact/contactDeleted';
import { type ContactUpdatedPayload, contactUpdated } from '#/appEvents/handlers/contact/contactUpdated';
import {
  type CustomerRefSegmentsAddedPayload,
  customerRefSegmentsAdded,
} from '#/appEvents/handlers/customerRef/customerRefSegmentsAdded';
import {
  type CustomerRefSegmentsRemovedPayload,
  customerRefSegmentsRemoved,
} from '#/appEvents/handlers/customerRef/customerRefSegmentsRemoved';
import { type InquiryResolvedPayload, inquiryResolved } from '#/appEvents/handlers/inquiry/inquiryResolved';
import { type InquirySentPayload, inquirySent } from '#/appEvents/handlers/inquiry/inquirySent';
import {
  type OrganizationDeletedPayload,
  organizationDeleted,
} from '#/appEvents/handlers/organization/organizationDeleted';
import {
  type OrganizationUpdatedPayload,
  organizationUpdated,
} from '#/appEvents/handlers/organization/organizationUpdated';
import {
  type RuleReferenceStalePayload,
  ruleReferenceStale,
} from '#/appEvents/handlers/ruleReference/ruleReferenceStale';
import { type SegmentCreatedPayload, segmentCreated } from '#/appEvents/handlers/segment/segmentCreated';
import { type SegmentDeletedPayload, segmentDeleted } from '#/appEvents/handlers/segment/segmentDeleted';
import { type SegmentMembersAddedPayload, segmentMembersAdded } from '#/appEvents/handlers/segment/segmentMembersAdded';
import {
  type SegmentMembersRemovedPayload,
  segmentMembersRemoved,
} from '#/appEvents/handlers/segment/segmentMembersRemoved';
import { type SegmentUpdatedPayload, segmentUpdated } from '#/appEvents/handlers/segment/segmentUpdated';
import { type SpaceDeletedPayload, spaceDeleted } from '#/appEvents/handlers/space/spaceDeleted';
import { type SpaceUpdatedPayload, spaceUpdated } from '#/appEvents/handlers/space/spaceUpdated';
import { type UserCreatedPayload, userCreated } from '#/appEvents/handlers/user/userCreated';
import { type UserRedactedPayload, userRedacted } from '#/appEvents/handlers/user/userRedacted';
import {
  type UserVerificationRequestedPayload,
  userVerificationRequested,
} from '#/appEvents/handlers/user/userVerificationRequested';
import type { AppEventHandlerFn } from '#/appEvents/makeAppEvent';

export type AppEventPayloads = {
  'communication.settled': CommunicationSettledPayload;
  'contact.created': ContactCreatedPayload;
  'contact.updated': ContactUpdatedPayload;
  'contact.deleted': ContactDeletedPayload;
  'customerRef.segmentsAdded': CustomerRefSegmentsAddedPayload;
  'customerRef.segmentsRemoved': CustomerRefSegmentsRemovedPayload;
  'inquiry.sent': InquirySentPayload;
  'inquiry.resolved': InquiryResolvedPayload;
  'organization.updated': OrganizationUpdatedPayload;
  'organization.deleted': OrganizationDeletedPayload;
  'ruleReference.stale': RuleReferenceStalePayload;
  'segment.created': SegmentCreatedPayload;
  'segment.updated': SegmentUpdatedPayload;
  'segment.deleted': SegmentDeletedPayload;
  'segment.membersAdded': SegmentMembersAddedPayload;
  'segment.membersRemoved': SegmentMembersRemovedPayload;
  'space.updated': SpaceUpdatedPayload;
  'space.deleted': SpaceDeletedPayload;
  'user.created': UserCreatedPayload;
  'user.redacted': UserRedactedPayload;
  'user.verificationRequested': UserVerificationRequestedPayload;
};

export const AppEventName = {
  communicationSettled: 'communication.settled',
  contactCreated: 'contact.created',
  contactUpdated: 'contact.updated',
  contactDeleted: 'contact.deleted',
  customerRefSegmentsAdded: 'customerRef.segmentsAdded',
  customerRefSegmentsRemoved: 'customerRef.segmentsRemoved',
  inquirySent: 'inquiry.sent',
  inquiryResolved: 'inquiry.resolved',
  organizationUpdated: 'organization.updated',
  organizationDeleted: 'organization.deleted',
  ruleReferenceStale: 'ruleReference.stale',
  segmentCreated: 'segment.created',
  segmentUpdated: 'segment.updated',
  segmentDeleted: 'segment.deleted',
  segmentMembersAdded: 'segment.membersAdded',
  segmentMembersRemoved: 'segment.membersRemoved',
  spaceUpdated: 'space.updated',
  spaceDeleted: 'space.deleted',
  userCreated: 'user.created',
  userRedacted: 'user.redacted',
  userVerificationRequested: 'user.verificationRequested',
} as const;

export type AppEventName = (typeof AppEventName)[keyof typeof AppEventName];

export const appEventHandlers: Record<AppEventName, AppEventHandlerFn> = {
  'communication.settled': communicationSettled,
  'contact.created': contactCreated,
  'contact.updated': contactUpdated,
  'contact.deleted': contactDeleted,
  'customerRef.segmentsAdded': customerRefSegmentsAdded,
  'customerRef.segmentsRemoved': customerRefSegmentsRemoved,
  'inquiry.sent': inquirySent,
  'inquiry.resolved': inquiryResolved,
  'organization.updated': organizationUpdated,
  'organization.deleted': organizationDeleted,
  'ruleReference.stale': ruleReferenceStale,
  'segment.created': segmentCreated,
  'segment.updated': segmentUpdated,
  'segment.deleted': segmentDeleted,
  'segment.membersAdded': segmentMembersAdded,
  'segment.membersRemoved': segmentMembersRemoved,
  'space.updated': spaceUpdated,
  'space.deleted': spaceDeleted,
  'user.created': userCreated,
  'user.redacted': userRedacted,
  'user.verificationRequested': userVerificationRequested,
};
