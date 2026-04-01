import {
  type LayoutLinesResult,
  layoutWithLines,
  type PreparedTextWithSegments,
  type PrepareOptions,
  prepareWithSegments,
} from '@chenglou/pretext';
import { cn } from '@template/ui/lib/utils';
import * as React from 'react';

export interface PretextSectionProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  show?: boolean | (() => boolean);
  /** The text content to measure and lay out via Pretext. */
  text: string;
  /** CSS font shorthand string, e.g. "16px Inter". Must match the rendered font. */
  font: string;
  /** Line height in pixels. */
  lineHeight: number;
  /** Optional Pretext prepare options (e.g. whiteSpace mode). */
  prepareOptions?: PrepareOptions;
  /**
   * Render prop receiving Pretext layout results.
   * When provided, replaces the default rendering with custom output.
   */
  children?: (result: PretextLayoutResult) => React.ReactNode;
}

export interface PretextLayoutResult {
  prepared: PreparedTextWithSegments;
  layout: LayoutLinesResult;
}

const PretextSection = React.forwardRef<HTMLDivElement, PretextSectionProps>(
  ({ className, show = true, text, font, lineHeight, prepareOptions, children, ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = React.useState<number | null>(null);

    React.useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    const result = React.useMemo<PretextLayoutResult | null>(() => {
      if (width === null || width <= 0 || !text) return null;
      const prepared = prepareWithSegments(text, font, prepareOptions);
      const layoutResult = layoutWithLines(prepared, width, lineHeight);
      return { prepared, layout: layoutResult };
    }, [text, font, lineHeight, width, prepareOptions]);

    const shouldShow = typeof show === 'function' ? show() : show;
    if (!shouldShow) return null;

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={cn('relative', className)}
        style={{ lineHeight: `${lineHeight}px`, font }}
        {...props}
      >
        {result === null ? (
          <span className="invisible">{text}</span>
        ) : typeof children === 'function' ? (
          children(result)
        ) : (
          result.layout.lines.map((line) => (
            <p key={`${line.start.segmentIndex}-${line.start.graphemeIndex}`} style={{ margin: 0, width: line.width }}>
              {line.text}
            </p>
          ))
        )}
      </div>
    );
  },
);
PretextSection.displayName = 'PretextSection';

export { PretextSection };
