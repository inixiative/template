import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getProjectConfig, type ProjectConfig } from './getProjectConfig';

type ConfigContextType = {
  config: ProjectConfig | null;
  syncConfig: () => Promise<void>;
};

const ConfigContext = createContext<ConfigContextType | null>(null);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<ProjectConfig | null>(null);

  const syncConfig = useCallback(async () => {
    const cfg = await getProjectConfig();
    setConfig(cfg);
  }, []);

  // Initial load
  useEffect(() => {
    syncConfig();
  }, [syncConfig]);

  return <ConfigContext.Provider value={{ config, syncConfig }}>{children}</ConfigContext.Provider>;
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within ConfigProvider');
  }
  return context;
};
