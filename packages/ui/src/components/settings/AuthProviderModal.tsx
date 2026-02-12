import { Button, Input, Label, Modal } from '@template/ui/components';
import type { OrganizationCreateAuthProviderData } from '@template/ui/apiClient';
import { memo, useState } from 'react';

type AuthProviderFormData = OrganizationCreateAuthProviderData['body'];

type AuthProviderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AuthProviderFormData) => void;
  provider?: Partial<AuthProviderFormData> & { id?: string };
  isLoading?: boolean;
};

export const AuthProviderModal = memo(
  ({ isOpen, onClose, onSubmit, provider, isLoading = false }: AuthProviderModalProps) => {
    const [type, setType] = useState<'EMAIL' | 'OAUTH' | 'SAML'>(provider?.type || 'OAUTH');
    const [providerName, setProviderName] = useState(provider?.provider || '');
    const [displayName, setDisplayName] = useState(provider?.name || '');
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();

      const formData: AuthProviderFormData = {
        type,
        provider: providerName.toLowerCase(),
        name: displayName,
        config: {},
        secrets: type === 'OAUTH' ? { clientId, clientSecret } : {},
      };

      onSubmit(formData);

      if (!provider) {
        setType('OAUTH');
        setProviderName('');
        setDisplayName('');
        setClientId('');
        setClientSecret('');
      }
    };

    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={provider ? 'Edit Auth Provider' : 'Add Auth Provider'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider-type">Type</Label>
            <select
              id="provider-type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              disabled={!!provider}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="OAUTH">OAuth</option>
              <option value="SAML">SAML/SSO</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider-name">Provider</Label>
            <Input
              id="provider-name"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="google, github, okta"
              disabled={!!provider}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Google OAuth"
              autoFocus
            />
          </div>

          {type === 'OAUTH' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="client-id">Client ID</Label>
                <Input
                  id="client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client-secret">Client Secret</Label>
                <Input
                  id="client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!providerName || !displayName || isLoading}>
              {isLoading ? 'Saving...' : provider ? 'Update' : 'Add Provider'}
            </Button>
          </div>
        </form>
      </Modal>
    );
  },
);
