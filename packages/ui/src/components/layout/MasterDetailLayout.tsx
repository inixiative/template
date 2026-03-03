import { cn } from '@template/ui/lib/utils';

export type MasterDetailLayoutProps = {
  master?: React.ReactNode;
  detail: React.ReactNode;
  className?: string;
};

export const MasterDetailLayout = ({ master, detail, className }: MasterDetailLayoutProps) => {
  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex flex-1 min-h-0">
        {master && <div className="w-[30%] border-r overflow-y-auto">{master}</div>}
        <div className={cn('flex-1 flex flex-col', !master && 'w-full')}>
          <div className="flex-1 overflow-y-auto">{detail}</div>
        </div>
      </div>
    </div>
  );
};
