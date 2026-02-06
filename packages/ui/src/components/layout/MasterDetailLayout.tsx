import { cn } from '@ui/lib/utils';

export type MasterDetailLayoutProps = {
  master?: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
};

export const MasterDetailLayout = ({ master, detail, className }: MasterDetailLayoutProps) => {
  return (
    <div className={cn('flex h-full', className)}>
      {master && (
        <div className="w-[30%] border-r overflow-y-auto">
          {master}
        </div>
      )}
      <div className={cn('flex-1', !master && 'w-full')}>
        {detail}
      </div>
    </div>
  );
};
