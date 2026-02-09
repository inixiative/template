import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout } from '@template/shared';
import { Boxes, Key, Webhook } from 'lucide-react';
import { useState } from 'react';
import { SpaceProfileTab } from '#/components/settings/SpaceProfileTab';
import { SpaceTokensTab } from '#/components/settings/SpaceTokensTab';
import { SpaceWebhooksTab } from '#/components/settings/SpaceWebhooksTab';

const tabs = [
  { id: 'profile', label: 'Profile', icon: Boxes },
  { id: 'tokens', label: 'Tokens', icon: Key },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook },
];

const SpaceSettingsPage = () => {
  const { spaceId } = Route.useParams();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <SettingsLayout
      title="Space Settings"
      description="Manage space profile and API access"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'profile' && <SpaceProfileTab spaceId={spaceId} />}
      {activeTab === 'tokens' && <SpaceTokensTab spaceId={spaceId} />}
      {activeTab === 'webhooks' && <SpaceWebhooksTab spaceId={spaceId} />}
    </SettingsLayout>
  );
};

export const Route = createFileRoute('/_authenticated/space/$spaceId/settings')({
  component: SpaceSettingsPage,
});
