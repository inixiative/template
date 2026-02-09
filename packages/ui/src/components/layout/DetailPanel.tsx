import { cn } from '@template/ui/lib/utils';

export type DetailPanelProps = {
  header?: React.ReactNode;
  children: React.ReactNode;
  split?: React.ReactNode;
  className?: string;
};

export const DetailPanel = ({ header, children, split, className }: DetailPanelProps) => {
  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      {header && <div className="shrink-0 border-b bg-background">{header}</div>}
      <div className="flex flex-1 overflow-hidden">
        <div className={cn('flex-1 overflow-y-auto', split && 'w-1/2')}>{children}</div>
        {split && <div className="w-1/2 border-l bg-background overflow-y-auto">{split}</div>}
      </div>
    </div>
  );
};
