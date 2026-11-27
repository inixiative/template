/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import type * as React from 'react';

// why: the invisible skeleton underneath keeps a cell as large as its skeleton, loading or loaded
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
