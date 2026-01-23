import type { JobHandler } from '../types';
import { sendWebhook } from './sendWebhook';

// Register all job handlers here
export const jobHandlers: Record<string, JobHandler> = {
  sendWebhook,
  // Add more handlers as needed
};
