/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Modal } from '@template/ui/components/layout/Modal';
import { Button } from '@template/ui/components/primitives/Button';
import { CopyButton } from '@template/ui/components/primitives/CopyButton';

export type BackupCodesRevealModalProps = {
  codes: string[] | null;
  title?: string;
  onDismiss: () => void;
};

export const BackupCodesRevealModal = ({
  codes,
  title = 'Save your backup codes',
  onDismiss,
}: BackupCodesRevealModalProps) => {
  const joined = codes?.join('\n') ?? '';

  const handleDownload = () => {
    if (!codes) return;
    const blob = new Blob([`${joined}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={codes !== null} onClose={onDismiss} dismissOnBackdrop={false} title={title}>
      <div className="space-y-4">
        <p className="text-sm font-medium text-destructive">
          Save these single-use backup codes in a safe place. They will never be shown again.
        </p>

        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-3 font-mono text-sm">
          {codes?.map((code) => (
            <div key={code} className="select-all text-center tracking-wider">
              {code}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-2">
            <CopyButton value={joined} />
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              Download .txt
            </Button>
          </div>
          <Button type="button" onClick={onDismiss}>
            I've saved them
          </Button>
        </div>
      </div>
    </Modal>
  );
};
