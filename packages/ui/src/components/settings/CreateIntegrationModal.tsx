/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { MeCreateIntegrationData } from '@template/sdk';
import { Button, Input, Label, Modal } from '@template/ui/components';
import {
  type IntegrationProvider,
  integrationProviders,
} from '@template/ui/lib/integrationProviders';
import { memo, useState } from 'react';

type CreateIntegrationFormData = Pick<MeCreateIntegrationData['body'], 'name' | 'provider'>;

type CreateIntegrationModalProps = {
  provider: IntegrationProvider | null;
  onClose: () => void;
  onSubmit: (data: CreateIntegrationFormData) => void;
};

export const CreateIntegrationModal = memo(
  ({ provider, onClose, onSubmit }: CreateIntegrationModalProps) => {
    const [name, setName] = useState('');
    const trimmedName = name.trim();
    const label = provider ? integrationProviders[provider].label : '';

    const close = () => {
      setName('');
      onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!provider || !trimmedName) return;
      onSubmit({ name: trimmedName, provider });
      close();
    };

    return (
      <Modal isOpen={provider !== null} onClose={close} title={`Connect ${label}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="integration-name">Integration name</Label>
            <Input
              id="integration-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`My ${label}`}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Names are unique per owner, so you can connect several {label} accounts.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmedName}>
              Connect
            </Button>
          </div>
        </form>
      </Modal>
    );
  },
);
