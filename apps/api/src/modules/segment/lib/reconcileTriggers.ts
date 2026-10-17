/**
 * @atlas
 * @kind config
 * @partOf feature:segment
 * @uses primitive:appEvents
 */
import type { ModelName } from '@template/db';
import type { AppEventName } from '#/appEvents/handlers';

/** The events that carry a change of each model the segment lens reads — the propagation graph, keyed by the lens. */
export const RECONCILE_TRIGGERS: Partial<Record<ModelName, AppEventName[]>> = {
  CommunicationLog: ['communication.settled'],
  Contact: ['contact.created', 'contact.updated', 'contact.deleted'],
  CustomerRef: ['customerRef.created'],
  Organization: ['organization.updated', 'organization.deleted'],
  Segment: ['segment.created', 'segment.updated', 'segment.deleted'],
  SegmentMember: ['segment.membersAdded', 'segment.membersRemoved'],
  Space: ['space.updated', 'space.deleted'],
  Tag: ['tag.deleted'],
  TagAttachment: ['tagAttachment.created', 'tagAttachment.deleted'],
  User: ['user.updated', 'user.redacted'],
};
