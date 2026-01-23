import * as z from 'zod';

export const WebhookModelSchema = z.enum(['User', 'Pool', 'Investment', 'Phase', 'Event', 'Payout', 'GovernanceProposal', 'Trade'])

export type WebhookModel = z.infer<typeof WebhookModelSchema>;