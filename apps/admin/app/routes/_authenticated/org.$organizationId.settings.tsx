import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout } from '@template/shared';
import { Building2, Key, Webhook } from 'lucide-react';
import { useState } from 'react';
import { OrganizationProfileTab } from '#/components/settings/OrganizationProfileTab';
import { OrganizationTokensTab } from '#/components/settings/OrganizationTokensTab';
import { OrganizationWebhooksTab } from '#/components/settings/OrganizationWebhooksTab';

const tabs = [
  { id: 'profile', label: 'Profile', icon: Building2 },
  { id: 'tokens', label: 'Tokens', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
];

const OrganizationSettingsPage = () => {
  const { organizationId } = Route.useParams();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <SettingsLayout
      title="Organization Settings"
      description="Manage organization profile and API access"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'profile' && <OrganizationProfileTab organizationId={organizationId} />}
      {activeTab === 'tokens' && <OrganizationTokensTab organizationId={organizationId} />}
      {activeTab === 'webhooks' && <OrganizationWebhooksTab organizationId={organizationId} />}
    </SettingsLayout>
  );
};

export const Route = createFileRoute('/_authenticated/org/$organizationId/settings')({
  component: OrganizationSettingsPage,
});
