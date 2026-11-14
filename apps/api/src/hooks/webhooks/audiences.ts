/**
 * @atlas
 * @kind registry
 * @partOf feature:webhooks
 * @uses feature:files
 */
import type { WebhookModel } from '@template/db/generated/client/enums';
import type { Party, WebhookRow } from '#/hooks/webhooks/parties';
import {
  artifactPermissionGranteeAudience,
  artifactWebhookAudience,
} from '#/modules/artifact/services/artifactWebhookAudience';

export type WebhookAudienceResolver = (rows: WebhookRow[]) => Promise<Map<string, Party[]>>;

export const webhookGrantedAudiences: Partial<Record<WebhookModel, WebhookAudienceResolver>> = {
  Artifact: artifactWebhookAudience,
};

export const webhookRelatedRowAudiences: Partial<Record<string, WebhookAudienceResolver>> = {
  ArtifactPermission: artifactPermissionGranteeAudience,
};
