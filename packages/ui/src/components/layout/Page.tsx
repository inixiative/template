/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { cn } from '@template/ui/lib/utils';
import type * as React from 'react';

export type PageProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export const Page = ({ title, description, actions, children, className }: PageProps) => (
  <div className={cn('mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10', className)}>
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
    <div className="flex flex-col gap-6">{children}</div>
  </div>
);
