/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Modal } from '@template/ui/components/layout/Modal';
import { Button } from '@template/ui/components/primitives/Button';
import { CopyButton } from '@template/ui/components/primitives/CopyButton';
import { Input } from '@template/ui/components/primitives/Input';
import { Label } from '@template/ui/components/primitives/Label';

export type SecretRevealModalProps = {
  secret: string | null;
  title: string;
  label: string;
  onDismiss: () => void;
};

export const SecretRevealModal = ({ secret, title, label, onDismiss }: SecretRevealModalProps) => (
  <Modal isOpen={secret !== null} onClose={onDismiss} dismissOnBackdrop={false} title={title}>
    <div className="space-y-4">
      <p className="text-sm font-medium text-destructive">This will never be shown again.</p>
      <div className="space-y-2">
        <Label htmlFor="revealed-secret">{label}</Label>
        <div className="flex gap-2">
          <Input
            id="revealed-secret"
            readOnly
            value={secret ?? ''}
            className="font-mono text-sm"
            onFocus={(event) => event.currentTarget.select()}
          />
          <CopyButton value={secret ?? ''} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onDismiss}>
          I've saved it
        </Button>
      </div>
    </div>
  </Modal>
);
