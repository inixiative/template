import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout, UserProfileTab, UserTokensTab, UserWebhooksTab } from '@template/shared';
import { Key, User, Webhook } from 'lucide-react';
import { useState } from 'react';

const tabs = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'tokens', label: 'Tokens', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
];

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <SettingsLayout
      title="Settings"
      description="Manage your account settings and preferences"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'profile' && <UserProfileTab />}
      {activeTab === 'tokens' && <UserTokensTab />}
      {activeTab === 'webhooks' && <UserWebhooksTab />}
    </SettingsLayout>
  );
};

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
});
