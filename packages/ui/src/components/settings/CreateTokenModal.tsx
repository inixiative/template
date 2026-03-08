import type { MeCreateTokenData } from '@template/ui/apiClient';
import { Button, Input, Label, Modal, Select } from '@template/ui/components';
import { enumToSelectOptions } from '@template/ui/lib/enumOptions';
import { memo, useState } from 'react';

type CreateTokenFormData = Pick<MeCreateTokenData['body'], 'name' | 'role'>;
type TokenRole = CreateTokenFormData['role'];

const tokenRoleValues = ['owner', 'admin', 'member', 'viewer'] as const satisfies readonly TokenRole[];
const tokenRoleOptions = enumToSelectOptions<TokenRole>(tokenRoleValues);

type CreateTokenModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateTokenFormData) => void;
  title?: string;
};

export const CreateTokenModal = memo(
  ({ isOpen, onClose, onSubmit, title = 'Create API Token' }: CreateTokenModalProps) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState<TokenRole>(tokenRoleValues[0]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (name.trim()) {
        onSubmit({ name: name.trim(), role });
        setName('');
        setRole(tokenRoleValues[0]);
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

          <div className="space-y-2">
            <Label htmlFor="token-role">Role</Label>
            <Select id="token-role" value={role} onChange={setRole} options={tokenRoleOptions} />
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
