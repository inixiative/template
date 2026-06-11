/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Toaster as SonnerToaster } from 'sonner';

export const Toaster = () => {
  return <SonnerToaster position="top-right" closeButton richColors />;
};
