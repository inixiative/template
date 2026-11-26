/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useAppStore } from '@template/ui/store';
import type { ReactNode } from 'react';

export type AuthPageShellProps = {
  subtitle: ReactNode;
  wide?: boolean;
  children: ReactNode;
};

export const AuthPageShell = ({ subtitle, wide, children }: AuthPageShellProps) => {
  const projectName = useAppStore((state) => state.ui.projectName);
  const appName = useAppStore((state) => state.ui.appName);

  return (
    <div className="min-h-full flex items-center justify-center p-4 bg-gradient-to-br from-muted via-background to-background">
      <div className={wide ? 'w-full max-w-2xl' : 'w-full max-w-md'}>
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {projectName} <span className="text-muted-foreground font-normal">{appName}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  );
};
