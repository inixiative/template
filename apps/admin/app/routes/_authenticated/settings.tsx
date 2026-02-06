import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout, UserProfileTab, UserTokensTab, UserWebhooksTab } from '@template/shared';
import { User, Key, Webhook } from 'lucide-react';
import { useState } from 'react';

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
}
