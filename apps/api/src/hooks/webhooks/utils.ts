import {
  type FlexibleRef,
  filterIgnoredFields,
  type WebhookModel,
  webhookEnabledModels,
  webhookRelatedModels,
} from '@template/db';
import { isEqual } from 'lodash-es';

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

export const isNoOpUpdate = <T extends Record<string, unknown>>(
  model: string,
  currentData: T,
  previousData: T | undefined,
): boolean => {
  if (!previousData) return false;

  const current = filterIgnoredFields(model, currentData);
  const previous = filterIgnoredFields(model, previousData);

  return isEqual(current, previous);
};
