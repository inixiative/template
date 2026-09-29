/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { cn } from '@template/ui/lib/utils';
import { useAppStore } from '@template/ui/store';

export const AppIdentity = ({ className }: { className?: string }) => {
  const shortName = useAppStore((state) => state.ui.shortName);
  const logo = useAppStore((state) => state.ui.logo);

  return (
    <div className={cn('flex items-center gap-2 font-bold tracking-tight', className)}>
      {logo && <img src={logo} alt="" className="h-6 w-auto" />}
      <span>{shortName}</span>
    </div>
  );
};
