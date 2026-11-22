/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { useMemo } from 'react';
import { encode } from 'uqr';

export type QrCodeSvgProps = {
  value: string;
  size?: number;
  label?: string;
};

export const QrCodeSvg = ({
  value,
  size = 192,
  label = 'Authenticator app QR code',
}: QrCodeSvgProps) => {
  const { matrixSize, pathData } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 2 });
    const commands: string[] = [];
    for (let y = 0; y < qr.size; y += 1) {
      const row = qr.data[y];
      if (!row) continue;
      for (let x = 0; x < qr.size; x += 1) {
        if (row[x]) commands.push(`M${x} ${y}h1v1h-1z`);
      }
    }
    return { matrixSize: qr.size, pathData: commands.join('') };
  }, [value]);

  return (
    <div className="inline-flex rounded-lg border bg-white p-2">
      <svg
        role="img"
        aria-label={label}
        width={size}
        height={size}
        viewBox={`0 0 ${matrixSize} ${matrixSize}`}
        shapeRendering="crispEdges"
      >
        <rect width={matrixSize} height={matrixSize} fill="#ffffff" />
        <path d={pathData} fill="#000000" />
      </svg>
    </div>
  );
};
