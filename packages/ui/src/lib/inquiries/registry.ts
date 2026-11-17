/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { InquiryItem } from '@template/sdk';
import type { InquiryType } from '@template/ui/lib/inquiries/queryKeys';
import type { ComponentType } from 'react';

export type InquirySourceInterface = {
  summary: ComponentType<{ inquiry: InquiryItem }>;
  detail?: ComponentType<{ inquiry: InquiryItem; onClose: () => void }>;
  compose?: ComponentType<{ inquiry?: InquiryItem; onClose: () => void }>;
};

export type InquiryTargetInterface = {
  summary: ComponentType<{ inquiry: InquiryItem }>;
  detail?: ComponentType<{ inquiry: InquiryItem; onClose: () => void }>;
  review?: ComponentType<{ inquiry: InquiryItem; onClose: () => void }>;
};

export type InquiryInterfaceEntry = {
  label: string;
  source?: InquirySourceInterface;
  target?: InquiryTargetInterface;
};

const registry: Partial<Record<InquiryType, InquiryInterfaceEntry>> = {};

export const registerInquiryType = (type: InquiryType, entry: InquiryInterfaceEntry): void => {
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
    source: mergedSource as InquirySourceInterface | undefined,
    target: mergedTarget as InquiryTargetInterface | undefined,
  };
};

export const getInquiryInterface = (type: InquiryType): InquiryInterfaceEntry | undefined =>
  registry[type];
