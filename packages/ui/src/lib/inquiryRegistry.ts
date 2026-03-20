import type { InquiryReceivedItem, InquirySentItem } from '@template/ui/apiClient';
import type { InquiryType } from '@template/ui/lib/inquiryQueryKeys';
import type { ComponentType } from 'react';

export type InquirySourceInterface = {
  /** Powers the row summary cell in inquiry lists */
  summary: ComponentType<{ inquiry: InquirySentItem }>;
  /** Full detail view (drawer/page body) */
  detail?: ComponentType<{ inquiry: InquirySentItem; onClose: () => void }>;
  /** Create or edit the inquiry — same interface, different save target */
  compose?: ComponentType<{ inquiry?: InquirySentItem; onClose: () => void }>;
};

export type InquiryTargetInterface = {
  /** Powers the row summary cell in inquiry lists */
  summary: ComponentType<{ inquiry: InquiryReceivedItem }>;
  /** Full detail view (drawer/page body) */
  detail?: ComponentType<{ inquiry: InquiryReceivedItem; onClose: () => void }>;
  /** Target-side decision UI — context the approver needs before acting */
  review?: ComponentType<{ inquiry: InquiryReceivedItem; onClose: () => void }>;
};

export type InquiryInterfaceEntry = {
  label: string;
  source?: InquirySourceInterface;
  target?: InquiryTargetInterface;
};

const registry: Partial<Record<InquiryType, InquiryInterfaceEntry>> = {};

export const registerInquiryType = (type: InquiryType, entry: InquiryInterfaceEntry): void => {
  const existing = registry[type];
  const mergedSource = existing?.source || entry.source ? { ...existing?.source, ...entry.source } : undefined;
  const mergedTarget = existing?.target || entry.target ? { ...existing?.target, ...entry.target } : undefined;
  registry[type] = {
    ...existing,
    ...entry,
    // cast because spread of optional objects widens summary to `... | undefined`,
    // but callers always provide summary when registering source/target
    source: mergedSource as InquirySourceInterface | undefined,
    target: mergedTarget as InquiryTargetInterface | undefined,
  };
};

export const getInquiryInterface = (type: InquiryType): InquiryInterfaceEntry | undefined => registry[type];
