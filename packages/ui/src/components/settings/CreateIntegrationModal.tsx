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
  provider: IntegrationProvider | null | undefined;
  onClose: () => void;
  onSubmit: (data: CreateIntegrationFormData) => void;
};

const providerCopy = (label: string) => ({
  title: `Connect ${label}`,
  placeholder: `My ${label}`,
  hint: `Names are unique per owner, so you can connect several ${label} accounts.`,
  submit: 'Connect',
});

const customCopy = {
  title: 'Add custom integration',
  placeholder: 'My integration',
  hint: 'A custom integration has no provider. Names are unique per owner.',
  submit: 'Add',
};

export const CreateIntegrationModal = memo(
  ({ provider, onClose, onSubmit }: CreateIntegrationModalProps) => {
    const [name, setName] = useState('');
    const trimmedName = name.trim();
    const copy = provider ? providerCopy(integrationProviders[provider].label) : customCopy;

    const close = () => {
      setName('');
      onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!trimmedName) return;
      onSubmit({ name: trimmedName, provider: provider ?? null });
      close();
    };

    return (
      <Modal isOpen={provider !== undefined} onClose={close} title={copy.title}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="integration-name">Integration name</Label>
            <Input
              id="integration-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={copy.placeholder}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">{copy.hint}</p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!trimmedName}>
              {copy.submit}
            </Button>
          </div>
        </form>
      </Modal>
    );
  },
);
