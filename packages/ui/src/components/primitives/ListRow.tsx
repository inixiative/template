/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import type * as React from 'react';

export type ListRowProps = {
  name: React.ReactNode;
  badges?: React.ReactNode;
  secondary?: React.ReactNode;
  actions?: React.ReactNode;
  details?: React.ReactNode;
  testId?: string;
};

export const ListRow = ({ name, badges, secondary, actions, details, testId }: ListRowProps) => (
  <li className="px-4 py-3 text-sm" data-testid={testId}>
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          {badges}
        </div>
        {secondary === undefined || secondary === null ? null : (
          <div className="truncate text-xs text-muted-foreground">{secondary}</div>
        )}
      </div>
      {actions}
    </div>
    {details}
  </li>
);
