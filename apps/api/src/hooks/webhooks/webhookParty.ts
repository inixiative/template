/**
 * @atlas
 * @kind type
 * @partOf feature:webhooks
 * @uses none
 */
import type { WebhookOwnerModel } from '@template/db/generated/client/enums';

export type WebhookRow = Record<string, unknown> & { id: string };

export type WebhookParty = { kind: WebhookOwnerModel; id: string };

export type WebhookAudienceResolver = (rows: WebhookRow[]) => Promise<Map<string, WebhookParty[]>>;
