import type { WebhookModel, FlexibleRef } from '@template/db';
import { isEqual, omit } from 'lodash-es';
import { webhookEnabledModels } from '#/hooks/webhooks/constants/enabledModels';
import { webhookIgnoredFields } from '#/hooks/webhooks/constants/ignoredFields';
import { webhookModelSubscribers } from '#/hooks/webhooks/constants/ownerAllowedModels';
import { webhookRelatedModels } from '#/hooks/webhooks/constants/relatedModels';

let __enabledModelsSet = new Set<WebhookModel>(webhookEnabledModels);

export const isWebhookEnabled = (model: string): boolean => {
  return __enabledModelsSet.has(model as WebhookModel);
};

// Testing helpers
export const setWebhookEnabledModels = (models: WebhookModel[]): void => {
  __enabledModelsSet = new Set(models);
};

export const resetWebhookEnabledModels = (): void => {
  __enabledModelsSet = new Set(webhookEnabledModels);
};

export const getRelatedWebhookRefs = (model: string): FlexibleRef[] | null => {
  const refs = webhookRelatedModels[model];
  return refs?.length ? refs : null;
};

export const getIgnoredFields = (model: string): string[] => {
  const global = webhookIgnoredFields._global ?? [];
  const modelSpecific = webhookIgnoredFields[model] ?? [];
  return [...global, ...modelSpecific];
};

export const getModelSubscribers = (model: string): string[] => {
  return webhookModelSubscribers[model as keyof typeof webhookModelSubscribers] ?? [];
};

export const selectRelevantFields = <T extends Record<string, unknown>>(model: string, data: T): Partial<T> => {
  return omit(data, getIgnoredFields(model)) as Partial<T>;
};

export const isNoOpUpdate = <T extends Record<string, unknown>>(
  model: string,
  currentData: T,
  previousData: T | undefined,
): boolean => {
  if (!previousData) return false;

  const current = selectRelevantFields(model, currentData);
  const previous = selectRelevantFields(model, previousData);

  return isEqual(current, previous);
};
