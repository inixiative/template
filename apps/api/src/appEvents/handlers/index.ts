import {
  type BillingAccountStatusChangedPayload,
  billingAccountStatusChanged,
} from '#/appEvents/handlers/billingAccount/billingAccountStatusChanged';
import {
  type CommunicationOutcomeRecordedPayload,
  communicationOutcomeRecorded,
} from '#/appEvents/handlers/communication/communicationOutcomeRecorded';
import {
  type ContactCreatedPayload,
  contactCreated,
} from '#/appEvents/handlers/contact/contactCreated';
import {
  type ContactDeletedPayload,
  contactDeleted,
} from '#/appEvents/handlers/contact/contactDeleted';
import {
  type ContactUpdatedPayload,
  contactUpdated,
} from '#/appEvents/handlers/contact/contactUpdated';
import {
  type CustomerRelationshipCreatedPayload,
  customerRelationshipCreated,
} from '#/appEvents/handlers/customerRelationship/customerRelationshipCreated';
import {
  type CustomerRelationshipSegmentsAddedPayload,
  customerRelationshipSegmentsAdded,
} from '#/appEvents/handlers/customerRelationship/customerRelationshipSegmentsAdded';
import {
  type CustomerRelationshipSegmentsRemovedPayload,
  customerRelationshipSegmentsRemoved,
} from '#/appEvents/handlers/customerRelationship/customerRelationshipSegmentsRemoved';
import {
  type InquiryResolvedPayload,
  inquiryResolved,
} from '#/appEvents/handlers/inquiry/inquiryResolved';
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
  type RollingCacheLeafStuckPayload,
  rollingCacheLeafStuck,
} from '#/appEvents/handlers/rollingCache/rollingCacheLeafStuck';
import {
  type RollingCacheRefreshedPayload,
  rollingCacheRefreshed,
} from '#/appEvents/handlers/rollingCache/rollingCacheRefreshed';
import {
  type SegmentCreatedPayload,
  segmentCreated,
} from '#/appEvents/handlers/segment/segmentCreated';
import {
  type SegmentDeletedPayload,
  segmentDeleted,
} from '#/appEvents/handlers/segment/segmentDeleted';
import {
  type SegmentMembersAddedPayload,
  segmentMembersAdded,
} from '#/appEvents/handlers/segment/segmentMembersAdded';
import {
  type SegmentMembersRemovedPayload,
  segmentMembersRemoved,
} from '#/appEvents/handlers/segment/segmentMembersRemoved';
import {
  type SegmentUpdatedPayload,
  segmentUpdated,
} from '#/appEvents/handlers/segment/segmentUpdated';
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
  'billingAccount.statusChanged': BillingAccountStatusChangedPayload;
  'communication.outcomeRecorded': CommunicationOutcomeRecordedPayload;
  'contact.created': ContactCreatedPayload;
  'contact.updated': ContactUpdatedPayload;
  'contact.deleted': ContactDeletedPayload;
  'customerRelationship.created': CustomerRelationshipCreatedPayload;
  'customerRelationship.segmentsAdded': CustomerRelationshipSegmentsAddedPayload;
  'customerRelationship.segmentsRemoved': CustomerRelationshipSegmentsRemovedPayload;
  'inquiry.sent': InquirySentPayload;
  'inquiry.resolved': InquiryResolvedPayload;
  'organization.updated': OrganizationUpdatedPayload;
  'organization.deleted': OrganizationDeletedPayload;
  'rollingCache.leafStuck': RollingCacheLeafStuckPayload;
  'rollingCache.refreshed': RollingCacheRefreshedPayload;
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
  billingAccountStatusChanged: 'billingAccount.statusChanged',
  communicationOutcomeRecorded: 'communication.outcomeRecorded',
  contactCreated: 'contact.created',
  contactUpdated: 'contact.updated',
  contactDeleted: 'contact.deleted',
  customerRelationshipCreated: 'customerRelationship.created',
  customerRelationshipSegmentsAdded: 'customerRelationship.segmentsAdded',
  customerRelationshipSegmentsRemoved: 'customerRelationship.segmentsRemoved',
  inquirySent: 'inquiry.sent',
  inquiryResolved: 'inquiry.resolved',
  organizationUpdated: 'organization.updated',
  organizationDeleted: 'organization.deleted',
  rollingCacheLeafStuck: 'rollingCache.leafStuck',
  rollingCacheRefreshed: 'rollingCache.refreshed',
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
  'billingAccount.statusChanged': billingAccountStatusChanged,
  'communication.outcomeRecorded': communicationOutcomeRecorded,
  'contact.created': contactCreated,
  'contact.updated': contactUpdated,
  'contact.deleted': contactDeleted,
  'customerRelationship.created': customerRelationshipCreated,
  'customerRelationship.segmentsAdded': customerRelationshipSegmentsAdded,
  'customerRelationship.segmentsRemoved': customerRelationshipSegmentsRemoved,
  'inquiry.sent': inquirySent,
  'inquiry.resolved': inquiryResolved,
  'organization.updated': organizationUpdated,
  'organization.deleted': organizationDeleted,
  'rollingCache.leafStuck': rollingCacheLeafStuck,
  'rollingCache.refreshed': rollingCacheRefreshed,
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
