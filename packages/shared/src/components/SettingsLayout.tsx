import { useState } from 'react';
import { cn } from '@ui/lib/utils';

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
        <div className="p-8 pb-0">
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && <p className="text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="px-8 pt-6">
          <div className="flex gap-6 border-b">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
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
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
};
