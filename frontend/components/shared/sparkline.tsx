"use client";

/**
 * Sparkline SVG thuần (không cần thư viện chart) cho KPI cards.
 * Màu lấy theo `currentColor` để tuân thủ Token Rule — cha quyết định màu.
 */
export function Sparkline({
  data,
  width = 72,
  height = 24,
  strokeWidth = 2,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}) {
  if (data.length < 2) {
    return null;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const padY = strokeWidth;

  const points = data
    .map((value, index) => {
      const x = index * stepX;
      const y = height - padY - ((value - min) / range) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}
