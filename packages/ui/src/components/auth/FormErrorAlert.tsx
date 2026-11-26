/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */

export type FormErrorAlertProps = {
  message: string;
  detail?: string;
};

export const FormErrorAlert = ({ message, detail }: FormErrorAlertProps) => (
  <div
    role="alert"
    className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
  >
    {message}
    {detail && <div className="mt-1 text-xs opacity-80 break-all">{detail}</div>}
  </div>
);
