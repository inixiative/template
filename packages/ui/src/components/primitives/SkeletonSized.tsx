/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import type * as React from 'react';

// Content that is never smaller than its skeleton: the skeleton sits invisibly under the content,
// so a row whose buttons are hidden is as tall as one that shows them, loading or loaded.
export const SkeletonSized = ({
  skeleton,
  children,
}: {
  skeleton: React.ReactNode;
  children: React.ReactNode;
}) =>
  skeleton === undefined ? (
    children
  ) : (
    <div className="grid items-center [&>*]:col-start-1 [&>*]:row-start-1">
      <div className="invisible">{skeleton}</div>
      <div>{children}</div>
    </div>
  );
