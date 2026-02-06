import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout } from '@template/shared';
import { User, Key, Webhook } from 'lucide-react';
import { useState } from 'react';
import { UserProfileTab } from '#/components/settings/UserProfileTab';
import { UserTokensTab } from '#/components/settings/UserTokensTab';
import { UserWebhooksTab } from '#/components/settings/UserWebhooksTab';

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
});

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'tokens', label: 'Tokens', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
];

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <SettingsLayout
      title="Platform Settings"
      description="Manage platform administrator settings"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'profile' && <UserProfileTab />}
      {activeTab === 'tokens' && <UserTokensTab />}
      {activeTab === 'webhooks' && <UserWebhooksTab />}
    </SettingsLayout>
  );
}
