/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useEffect, useState } from 'react';

// why: filled after mount; a live region speaks only when its text changes
export const SkeletonStatus = ({ isLoading }: { isLoading?: boolean }) => {
  const [message, setMessage] = useState('');
  useEffect(() => setMessage(isLoading ? 'Loading…' : ''), [isLoading]);

  if (isLoading === undefined) return null;
  return (
    <span role="status" className="sr-only">
      {message}
    </span>
  );
};
