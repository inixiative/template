import {
  type CommunicationSettledPayload,
  communicationSettled,
} from '#/appEvents/handlers/communication/communicationSettled';
import { type ContactCreatedPayload, contactCreated } from '#/appEvents/handlers/contact/contactCreated';
import { type ContactDeletedPayload, contactDeleted } from '#/appEvents/handlers/contact/contactDeleted';
import { type ContactUpdatedPayload, contactUpdated } from '#/appEvents/handlers/contact/contactUpdated';
import {
  type CustomerRefCreatedPayload,
  customerRefCreated,
} from '#/appEvents/handlers/customerRef/customerRefCreated';
import {
  type CustomerRefSegmentsAddedPayload,
  customerRefSegmentsAdded,
} from '#/appEvents/handlers/customerRef/customerRefSegmentsAdded';
import {
  type CustomerRefSegmentsRemovedPayload,
  customerRefSegmentsRemoved,
} from '#/appEvents/handlers/customerRef/customerRefSegmentsRemoved';
import {
  type FeatureFlagChangedPayload,
  featureFlagChanged,
} from '#/appEvents/handlers/featureFlag/featureFlagChanged';
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
import { type TagDeletedPayload, tagDeleted } from '#/appEvents/handlers/tag/tagDeleted';
import {
  type TagAttachmentCreatedPayload,
  tagAttachmentCreated,
} from '#/appEvents/handlers/tagAttachment/tagAttachmentCreated';
import {
  type TagAttachmentDeletedPayload,
  tagAttachmentDeleted,
} from '#/appEvents/handlers/tagAttachment/tagAttachmentDeleted';
import { type UserCreatedPayload, userCreated } from '#/appEvents/handlers/user/userCreated';
import { type UserRedactedPayload, userRedacted } from '#/appEvents/handlers/user/userRedacted';
import { type UserUpdatedPayload, userUpdated } from '#/appEvents/handlers/user/userUpdated';
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
  'customerRef.created': CustomerRefCreatedPayload;
  'customerRef.segmentsAdded': CustomerRefSegmentsAddedPayload;
  'customerRef.segmentsRemoved': CustomerRefSegmentsRemovedPayload;
  'featureFlag.changed': FeatureFlagChangedPayload;
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
  'tag.deleted': TagDeletedPayload;
  'tagAttachment.created': TagAttachmentCreatedPayload;
  'tagAttachment.deleted': TagAttachmentDeletedPayload;
  'user.created': UserCreatedPayload;
  'user.updated': UserUpdatedPayload;
  'user.redacted': UserRedactedPayload;
  'user.verificationRequested': UserVerificationRequestedPayload;
};

export const AppEventName = {
  communicationSettled: 'communication.settled',
  contactCreated: 'contact.created',
  contactUpdated: 'contact.updated',
  contactDeleted: 'contact.deleted',
  customerRefCreated: 'customerRef.created',
  customerRefSegmentsAdded: 'customerRef.segmentsAdded',
  customerRefSegmentsRemoved: 'customerRef.segmentsRemoved',
  featureFlagChanged: 'featureFlag.changed',
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
  tagDeleted: 'tag.deleted',
  tagAttachmentCreated: 'tagAttachment.created',
  tagAttachmentDeleted: 'tagAttachment.deleted',
  userCreated: 'user.created',
  userUpdated: 'user.updated',
  userRedacted: 'user.redacted',
  userVerificationRequested: 'user.verificationRequested',
} as const;

export type AppEventName = (typeof AppEventName)[keyof typeof AppEventName];

export const appEventHandlers: Record<AppEventName, AppEventHandlerFn> = {
  'communication.settled': communicationSettled,
  'contact.created': contactCreated,
  'contact.updated': contactUpdated,
  'contact.deleted': contactDeleted,
  'customerRef.created': customerRefCreated,
  'customerRef.segmentsAdded': customerRefSegmentsAdded,
  'customerRef.segmentsRemoved': customerRefSegmentsRemoved,
  'featureFlag.changed': featureFlagChanged,
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
  'tag.deleted': tagDeleted,
  'tagAttachment.created': tagAttachmentCreated,
  'tagAttachment.deleted': tagAttachmentDeleted,
  'user.created': userCreated,
  'user.updated': userUpdated,
  'user.redacted': userRedacted,
  'user.verificationRequested': userVerificationRequested,
};
