/**
 * Related Models
 *
 * Maps child models to their parent webhook model.
 * When a child changes, the webhook is sent for the parent model.
 */
export const webhookRelatedModels: Record<string, string> = {
  // OrganizationUser: 'Organization',
};
