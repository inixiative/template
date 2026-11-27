/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import { Page } from '@template/ui/components';
import { SettingTreeView } from '@template/ui/components/settings/SettingTreeView';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';

const membershipTitle = (context: AuthenticatedContext) =>
  `Your preferences in ${context.space?.name ?? context.organization?.name ?? 'this workspace'}`;

export const SettingsPage = () => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const hasMembership = useAppStore((state) => {
    if (context.type === 'space' && context.space)
      return Boolean(state.auth.spaceUsers?.[context.space.id]);
    if (context.type === 'organization' && context.organization)
      return Boolean(state.auth.organizationUsers?.[context.organization.id]);
    return false;
  });

  return (
    <Page title="Settings" description="Settings for where you are">
      <div className="max-w-2xl space-y-6">
        <SettingTreeView context={context} hideWhenEmpty={false} />
        {hasMembership ? (
          <SettingTreeView
            context={context}
            ownership={{ ownedByMyMembership: true }}
            title={membershipTitle(context)}
            description="Your own settings as a member here."
          />
        ) : null}
      </div>
    </Page>
  );
};
