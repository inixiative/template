/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryItem } from '@template/sdk';
import type { InquiryType } from '@template/ui/lib/inquiries/queryKeys';
import type { ComponentType } from 'react';

export type InquirySourceComponents = {
  summary: ComponentType<{ inquiry: InquiryItem }>;
  detail?: ComponentType<{ inquiry: InquiryItem; onClose: () => void }>;
  compose?: ComponentType<{ inquiry?: InquiryItem; onClose: () => void }>;
};

export type InquiryTargetComponents = {
  summary: ComponentType<{ inquiry: InquiryItem }>;
  detail?: ComponentType<{ inquiry: InquiryItem; onClose: () => void }>;
  review?: ComponentType<{ inquiry: InquiryItem; onClose: () => void }>;
};

export type InquiryTypeComponentsEntry = {
  label: string;
  source?: InquirySourceComponents;
  target?: InquiryTargetComponents;
};

const registry: Partial<Record<InquiryType, InquiryTypeComponentsEntry>> = {};

export const registerInquiryType = (type: InquiryType, entry: InquiryTypeComponentsEntry): void => {
  const existing = registry[type];
  const mergedSource =
    existing?.source || entry.source ? { ...existing?.source, ...entry.source } : undefined;
  const mergedTarget =
    existing?.target || entry.target ? { ...existing?.target, ...entry.target } : undefined;
  registry[type] = {
    ...existing,
    ...entry,
    // cast because spread of optional objects widens summary to `... | undefined`,
    // but callers always provide summary when registering source/target
    source: mergedSource as InquirySourceComponents | undefined,
    target: mergedTarget as InquiryTargetComponents | undefined,
  };
};

export const inquiryTypeComponentsFor = (
  type: InquiryType,
): InquiryTypeComponentsEntry | undefined => registry[type];
