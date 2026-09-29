/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { useNavigate } from '@tanstack/react-router';
import type { NavConfig } from '@template/ui/components/layout/navigationTypes';
import { useAppStore } from '@template/ui/store';
import { useLayoutEffect } from 'react';

export const useRegisterNavigation = (navConfig: NavConfig) => {
  const navigate = useNavigate();
  const setNavigate = useAppStore((state) => state.navigation.setNavigate);
  const setNavConfig = useAppStore((state) => state.navigation.setNavConfig);

  useLayoutEffect(() => {
    setNavigate(navigate);
    setNavConfig(navConfig);
  }, [navigate, navConfig, setNavConfig, setNavigate]);
};
