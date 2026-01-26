import { isEqual, omit } from 'lodash-es';
import { WEBHOOK_ENABLED_MODELS } from '#/hooks/webhooks/constants/enabledModels';
import { IGNORED_TRACKING_FIELDS } from '#/hooks/webhooks/constants/ignoredFields';
import { WEBHOOK_RELATED_MODELS } from '#/hooks/webhooks/constants/relatedModels';
import { WEBHOOK_SUBSCRIBERS } from '#/hooks/webhooks/constants/subscribers';

const enabledModelsSet = new Set(WEBHOOK_ENABLED_MODELS);

export function isWebhookEnabled(model: string): boolean {
  return enabledModelsSet.has(model);
}

export function getParentWebhookModel(model: string): string | null {
  return WEBHOOK_RELATED_MODELS[model] ?? null;
}

export function getIgnoredFields(model: string): string[] {
  const global = IGNORED_TRACKING_FIELDS._global ?? [];
  const modelSpecific = IGNORED_TRACKING_FIELDS[model] ?? [];
  return [...global, ...modelSpecific];
}

export function getSubscribers(model: string): Record<string, (data: Record<string, unknown>) => string | null> {
  return (
    (WEBHOOK_SUBSCRIBERS as Record<string, Record<string, (data: Record<string, unknown>) => string | null>>)[model] ??
    {}
  );
}

export function selectRelevantFields<T extends Record<string, unknown>>(model: string, data: T): Partial<T> {
  return omit(data, getIgnoredFields(model)) as Partial<T>;
}

export function isNoOpUpdate<T extends Record<string, unknown>>(
  model: string,
  currentData: T,
  previousData: T | undefined,
): boolean {
  if (!previousData) return false;

  const current = selectRelevantFields(model, currentData);
  const previous = selectRelevantFields(model, previousData);

  return isEqual(current, previous);
}
