import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * An LPG cylinder, drawn rather than loaded so it stays sharp at any size and
 * themes with the app. Built from the parts a real one has, top to bottom: the
 * brass valve, the protective collar with its carrying cut-out, the domed
 * shoulder, the body with its weld seam and label band, and the foot ring that
 * keeps it standing. A horizontal gradient gives the steel its curve.
 */

export type CylinderTone = "red" | "blue" | "silver";
export type CylinderSize = "small" | "standard" | "tall" | "large";

const TONES: Record<
  CylinderTone,
  { deep: string; base: string; light: string; shine: string }
> = {
  // The familiar domestic red
  red: { deep: "#6f0d12", base: "#d2232a", light: "#f0545a", shine: "#ffd2d4" },
  // Blue livery (e.g. the 5 kg blue / free-trade cylinders)
  blue: { deep: "#0a2552", base: "#1d5bbf", light: "#4f8ff0", shine: "#d6e6ff" },
  // An empty, or simply neutral, cylinder
  silver: { deep: "#4a5361", base: "#98a2b0", light: "#c8d0da", shine: "#f3f6f9" },
};

/** Body proportions per size class; everything else is derived from these. */
const SIZES: Record<CylinderSize, { bodyW: number; bodyH: number }> = {
  small: { bodyW: 76, bodyH: 58 }, // 5 kg: short and squat
  standard: { bodyW: 76, bodyH: 104 }, // 14.2 kg
  tall: { bodyW: 78, bodyH: 136 }, // 19 kg
  large: { bodyW: 92, bodyH: 164 }, // 47.5 kg
};

export function LpgCylinder({
  tone = "red",
  size = "standard",
  label,
  title,
  className,
}: {
  tone?: CylinderTone;
  size?: CylinderSize;
  /** Printed on the label band, e.g. "14.2 kg". Omitted for tiny icons. */
  label?: string;
  /** Accessible name; without one the drawing is treated as decoration. */
  title?: string;
  className?: string;
}) {
  // useId gives ":r1:"-style ids; colons are not safe inside url(#…)
  const id = useId().replace(/:/g, "");
  const c = TONES[tone];
  const { bodyW, bodyH } = SIZES[size];

  const W = bodyW + 24;
  const cx = W / 2;
  const valveH = 13;
  const collarW = Math.round(bodyW * 0.56);
  const collarH = 28;
  const domeH = Math.round(bodyW * 0.34);
  const neck = collarW / 2 - 3;
  const y0 = valveH + collarH * 0.6; // where the collar meets the dome
  const yShoulder = y0 + domeH;
  const yBottom = yShoulder + bodyH;
  const r = 12;
  const footW = Math.round(bodyW * 0.84);
  const footH = 13;
  const H = yBottom + footH + 9;
  const left = cx - bodyW / 2;
  const right = cx + bodyW / 2;

  const shell = [
    `M ${cx - neck} ${y0}`,
    `C ${left + 6} ${y0} ${left} ${y0 + domeH * 0.35} ${left} ${yShoulder}`,
    `L ${left} ${yBottom - r}`,
    `Q ${left} ${yBottom} ${left + r} ${yBottom}`,
    `L ${right - r} ${yBottom}`,
    `Q ${right} ${yBottom} ${right} ${yBottom - r}`,
    `L ${right} ${yShoulder}`,
    `C ${right} ${y0 + domeH * 0.35} ${right - 6} ${y0} ${cx + neck} ${y0}`,
    "Z",
  ].join(" ");

  const seamY = yShoulder + bodyH * 0.5;
  const labelH = Math.min(24, bodyH * 0.26);
  const labelY = seamY - labelH - bodyH * 0.12;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn("h-auto w-full", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title && <title>{title}</title>}
      <defs>
        {/* Steel curving away from the light: dark edge, bright crest, falloff */}
        <linearGradient id={`${id}-body`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={c.deep} />
          <stop offset="0.16" stopColor={c.base} />
          <stop offset="0.3" stopColor={c.light} />
          <stop offset="0.46" stopColor={c.base} />
          <stop offset="0.78" stopColor={c.deep} stopOpacity="0.92" />
          <stop offset="1" stopColor={c.deep} />
        </linearGradient>
        <linearGradient id={`${id}-dome`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={c.shine} stopOpacity="0.85" />
          <stop offset="0.55" stopColor={c.shine} stopOpacity="0.25" />
          <stop offset="1" stopColor={c.shine} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-collar`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={c.deep} />
          <stop offset="0.35" stopColor={c.light} />
          <stop offset="0.6" stopColor={c.base} />
          <stop offset="1" stopColor={c.deep} />
        </linearGradient>
        <linearGradient id={`${id}-foot`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#1b1f27" />
          <stop offset="0.3" stopColor="#4b5260" />
          <stop offset="0.55" stopColor="#2c313b" />
          <stop offset="1" stopColor="#14171d" />
        </linearGradient>
        <linearGradient id={`${id}-brass`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#7a5a1c" />
          <stop offset="0.4" stopColor="#f2cf72" />
          <stop offset="0.7" stopColor="#c4972f" />
          <stop offset="1" stopColor="#6b4d14" />
        </linearGradient>
        <radialGradient id={`${id}-shadow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <path d={shell} />
        </clipPath>
      </defs>

      {/* Ground shadow */}
      <ellipse
        cx={cx}
        cy={yBottom + footH + 3}
        rx={bodyW * 0.62}
        ry={6}
        fill={`url(#${id}-shadow)`}
      />

      {/* Foot ring, with vent slots, behind the shell's base */}
      <rect
        x={cx - footW / 2}
        y={yBottom - 6}
        width={footW}
        height={footH + 6}
        rx={3}
        fill={`url(#${id}-foot)`}
      />
      {[-0.26, 0.26].map((offset) => (
        <rect
          key={offset}
          x={cx + footW * offset - 5}
          y={yBottom + 3}
          width={10}
          height={4}
          rx={2}
          fill="#0b0d11"
          opacity={0.7}
        />
      ))}

      {/* Shell */}
      <path d={shell} fill={`url(#${id}-body)`} />

      <g clipPath={`url(#${id}-clip)`}>
        {/* Light falling on the shoulder */}
        <rect x={left} y={y0} width={bodyW} height={domeH + 4} fill={`url(#${id}-dome)`} />

        {/* Label band */}
        {label && (
          <>
            <rect x={left} y={labelY} width={bodyW} height={labelH} fill="#ffffff" opacity={0.94} />
            <rect x={left} y={labelY} width={bodyW} height={labelH} fill={`url(#${id}-body)`} opacity={0.18} />
            <text
              x={cx}
              y={labelY + labelH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
              fontWeight={800}
              fontSize={Math.min(13, labelH * 0.56)}
              letterSpacing="0.02em"
              fill={c.deep}
            >
              {label}
            </text>
          </>
        )}

        {/* Weld seam */}
        <rect x={left} y={seamY} width={bodyW} height={1.4} fill="#000" opacity={0.28} />
        <rect x={left} y={seamY + 1.4} width={bodyW} height={1} fill="#fff" opacity={0.22} />

        {/* Specular highlights */}
        <rect x={cx - bodyW * 0.33} y={y0 + 4} width={bodyW * 0.1} height={bodyH + domeH} rx={4} fill={`url(#${id}-shine)`} />
        <rect x={cx - bodyW * 0.18} y={y0 + 10} width={bodyW * 0.035} height={bodyH * 0.8 + domeH} rx={2} fill={`url(#${id}-shine)`} opacity={0.6} />
      </g>

      {/* Base rim where the shell meets the foot ring */}
      <rect x={left + r * 0.6} y={yBottom - 2.5} width={bodyW - r * 1.2} height={2.5} rx={1.2} fill="#000" opacity={0.25} />

      {/* Valve, rising through the collar */}
      <rect x={cx - 6.5} y={3} width={13} height={valveH + 10} rx={3} fill={`url(#${id}-brass)`} />
      <ellipse cx={cx} cy={4} rx={8.5} ry={3.2} fill={`url(#${id}-brass)`} />
      <ellipse cx={cx} cy={3.4} rx={4.5} ry={1.5} fill="#5a4210" opacity={0.6} />

      {/* Protective collar with its carrying cut-out */}
      <rect x={cx - collarW / 2} y={valveH} width={collarW} height={collarH} rx={7} fill={`url(#${id}-collar)`} />
      <rect
        x={cx - collarW * 0.32}
        y={valveH + collarH * 0.27}
        width={collarW * 0.64}
        height={collarH * 0.34}
        rx={collarH * 0.17}
        fill="#07090d"
        opacity={0.6}
      />
      <rect x={cx - collarW / 2 + 3} y={valveH + 2} width={collarW - 6} height={2} rx={1} fill="#fff" opacity={0.28} />
    </svg>
  );
}
