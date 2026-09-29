/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { cn } from '@template/ui/lib/utils';
import { useState } from 'react';

export type SettingsTab = {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

export type SettingsLayoutProps = {
  title: string;
  description?: string;
  tabs: SettingsTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
};

export const SettingsLayout = ({
  title,
  description,
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  children,
}: SettingsLayoutProps) => {
  const [internalActiveTab, setInternalActiveTab] = useState(tabs[0]?.id || '');
  const activeTab = controlledActiveTab ?? internalActiveTab;

  const handleTabChange = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b bg-background">
        <div className="mx-auto w-full max-w-6xl space-y-1.5 px-6 pt-8 lg:px-10 lg:pt-10">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="mx-auto w-full max-w-6xl px-6 pt-6 lg:px-10">
          <div className="flex gap-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-1 pb-3 border-b-2 transition-colors text-sm font-medium',
                    isActive
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  );
};
