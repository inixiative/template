/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Button } from '@template/ui/components/primitives/Button';

type BackupCodesSectionProps = {
  remaining: number;
  enabled: boolean;
  isBusy: boolean;
  onRegenerate: () => Promise<void>;
};

export const BackupCodesSection = ({
  remaining,
  enabled,
  isBusy,
  onRegenerate,
}: BackupCodesSectionProps) => {
  if (!enabled) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
      <div>
        <h4 className="text-sm font-medium">Backup recovery codes</h4>
        <p className="text-xs text-muted-foreground">
          {remaining} single-use recovery {remaining === 1 ? 'code' : 'codes'} remaining.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isBusy}
        onClick={() => void onRegenerate()}
      >
        Regenerate codes
      </Button>
    </div>
  );
};
