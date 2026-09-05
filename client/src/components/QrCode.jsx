import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * A QR code, drawn as one SVG path.
 *
 * Runs of dark modules are merged into a single horizontal rectangle each,
 * which turns a 29×29 grid of a few hundred squares into a path of a few dozen
 * — it scales to a projector or a printed bulletin without shipping an image.
 *
 * Error correction is Q (25%), not the usual M: these get pointed at from the
 * back of a room, off a screen, at an angle.
 */
const build = (value, margin) => {
  const q = qrcode(0, 'Q');
  q.addData(value);
  q.make();

  const count = q.getModuleCount();
  let d = '';
  for (let row = 0; row < count; row += 1) {
    let run = 0;
    for (let col = 0; col <= count; col += 1) {
      const dark = col < count && q.isDark(row, col);
      if (dark) { run += 1; continue; }
      if (run) d += `M${col - run + margin} ${row + margin}h${run}v1h-${run}z`;
      run = 0;
    }
  }
  return { d, extent: count + margin * 2 };
};

export const QrCode = ({ value, size = 168, margin = 4, label, className }) => {
  const { d, extent } = useMemo(() => build(value, margin), [value, margin]);

  return (
    <svg
      className={`qr ${className ?? ''}`}
      viewBox={`0 0 ${extent} ${extent}`}
      width={size}
      height={size}
      role="img"
      aria-label={label ?? `QR code for ${value}`}
      shapeRendering="crispEdges"
    >
      <rect width={extent} height={extent} fill="#fff" />
      <path d={d} fill="currentColor" />
    </svg>
  );
};

/** The same code as a path, for callers drawing their own canvas. */
export const qrPath = build;
