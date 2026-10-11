/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

export const useHashSection = (sectionId: string): [boolean, (open: boolean) => void] => {
  const { hash, pathname } = useLocation();
  const navigate = useNavigate();
  const setOpen = useCallback(
    (open: boolean) =>
      void navigate({
        to: pathname,
        search: true,
        hash: open ? sectionId : '',
        replace: true,
      }),
    [navigate, pathname, sectionId],
  );
  return [hash === sectionId, setOpen];
};
