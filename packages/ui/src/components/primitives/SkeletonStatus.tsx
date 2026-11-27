/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useEffect, useState } from 'react';

// The loading cue for screen readers, beside a skeleton (whose inert content is not read). Always
// mounted, and filled after mount: a live region speaks only when its text changes.
export const SkeletonStatus = ({ isLoading }: { isLoading: boolean }) => {
  const [message, setMessage] = useState('');
  useEffect(() => setMessage(isLoading ? 'Loading…' : ''), [isLoading]);

  return (
    <span role="status" className="sr-only">
      {message}
    </span>
  );
};
