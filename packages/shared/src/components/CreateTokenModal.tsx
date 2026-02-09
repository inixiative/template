import { Button, Input, Label, Modal } from '@template/ui';
import { memo, useState } from 'react';

type CreateTokenModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  title?: string;
};

export const CreateTokenModal = memo(
  ({ isOpen, onClose, onSubmit, title = 'Create API Token' }: CreateTokenModalProps) => {
    const [name, setName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (name.trim()) {
        onSubmit(name.trim());
        setName('');
        onClose();
      }
    };

    return (
      <Modal isOpen={isOpen} onClose={onClose} title={title}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-name">Token Name</Label>
            <Input
              id="token-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My API Token"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">A descriptive name to help you identify this token</p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create Token
            </Button>
          </div>
        </form>
      </Modal>
    );
  },
);
