import { cn } from '@template/ui/lib/utils';
import { Breadcrumbs } from '@template/ui/components/Breadcrumbs';

export type MasterDetailLayoutProps = {
  master?: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
  showBreadcrumbs?: boolean;
};

export const MasterDetailLayout = ({ master, detail, className, showBreadcrumbs = true }: MasterDetailLayoutProps) => {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex flex-1 min-h-0">
        {master && <div className="w-[30%] border-r overflow-y-auto">{master}</div>}
        <div className={cn('flex-1 flex flex-col', !master && 'w-full')}>
          {showBreadcrumbs && (
            <div className="border-b px-6 py-3">
              <Breadcrumbs />
            </div>
          )}
          <div className="flex-1 overflow-y-auto">{detail}</div>
        </div>
      </div>
    </div>
  );
};
