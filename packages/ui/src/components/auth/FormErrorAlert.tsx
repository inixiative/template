/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import type { ReactNode } from 'react';

export type FormErrorAlertProps = {
  message: string;
  detail?: string;
  action?: ReactNode;
};

export const FormErrorAlert = ({ message, detail, action }: FormErrorAlertProps) => (
  <div
    role="alert"
    className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
  >
    <div>
      {message}
      {detail && <div className="mt-1 text-xs opacity-80 break-all">{detail}</div>}
    </div>
    {action}
  </div>
);
