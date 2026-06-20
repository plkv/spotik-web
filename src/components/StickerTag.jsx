import { cn } from '@/lib/utils'

const PINK = '#F468CB'
const TEXT_COLOR = 'rgba(0,0,0,0.92)'

// Left-edge SVG path per variant (normalized: x starts at 0, height = 36)
// Right edge is always the horizontal mirror of the left edge.
const VARIANTS = {
  // Wavy organic bumps + centre notch
  1: {
    edgeW: 9.187,
    edgePath: 'M0 18C0 26.5849 5.12505 30.8617 6.06344 34.8117C6.21663 35.4565 6.74732 36 7.41006 36H9.18684V0H7.41006C6.74732 0 6.21663 0.5435 6.06344 1.1883C5.12505 5.13826 0 9.41515 0 18Z',
    hasCenter: true,
  },
  // Stepped rectangular notch + centre notch
  2: {
    edgeW: 8.7,
    edgePath: 'M6 31.2V34.8C6 35.4627 6.53726 36 7.2 36H8.7V0H7.2C6.53726 0 6 0.537258 6 1.2V4.8C6 5.46274 5.46274 6 4.8 6H1.2C0.537258 6 0 6.53726 0 7.2V28.8C0 29.4627 0.537258 30 1.2 30H4.8C5.46274 30 6 30.5373 6 31.2Z',
    hasCenter: true,
  },
  // Rounded pill bump, no centre notch
  5: {
    edgeW: 10.2,
    edgePath: 'M1.19234 30.1186C3.54949 30.5939 5.40627 32.4506 5.88153 34.8078C6.01252 35.4575 6.53726 36 7.2 36H10.2V0H7.2C6.53726 0 6.01252 0.542792 5.88153 1.19246C5.40627 3.54961 3.54949 5.40639 1.19234 5.88165C0.542671 6.01264 0 6.53738 0 7.2V28.8C0 29.4629 0.54267 29.9876 1.19234 30.1186Z',
    hasCenter: false,
  },
}

// Shared centre notch decoration (used by variants with hasCenter=true)
// Normalised from original Figma path (offset −30.7769).
const CENTER_W = 12.0464
const CENTER_PATH =
  'M6.0232 3.6C4.066 3.6 2.4736 2.03817 2.4243 0.0929C2.4237 0.0414 2.3818 0 2.3303 0H0V36H1.2232C1.8859 36 2.4036 35.448 2.6204 34.8217C3.1084 33.4122 4.4476 32.4 6.0232 32.4C7.5987 32.4 8.9379 33.4122 9.4259 34.8217C9.6428 35.448 10.1604 36 10.8232 36H12.0464V0H9.7161C9.6646 0 9.6227 0.0414 9.622 0.0929C9.5727 2.03816 7.9803 3.6 6.0232 3.6Z'

function EdgeSvg({ edgeW, edgePath, flip }) {
  return (
    <svg
      width={edgeW}
      height={36}
      viewBox={`0 0 ${edgeW} 36`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden="true"
    >
      <path d={edgePath} fill={PINK} />
    </svg>
  )
}

function CenterNotch() {
  return (
    <svg
      width={CENTER_W}
      height={36}
      viewBox={`0 0 ${CENTER_W} 36`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d={CENTER_PATH} fill={PINK} />
    </svg>
  )
}

/**
 * Sticker-shaped tag / button.
 *
 * Props:
 *   label    – text content
 *   variant  – shape variant (1, 2, or 5; defaults to 1)
 *   onClick  – if provided, renders as <button>
 *   active   – highlights the tag (full opacity); when false and onClick is set, dims to ~35%
 *   className / style – forwarded to root element
 */
export function StickerTag({ label, variant = 1, onClick, active, className, style }) {
  const Tag = onClick ? 'button' : 'span'
  const cfg = VARIANTS[variant] ?? VARIANTS[1]

  return (
    <Tag
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={cn(
        'relative inline-flex items-center h-9 select-none transition-opacity duration-150',
        onClick && 'cursor-pointer',
        onClick && !active && 'opacity-35 hover:opacity-60',
        className,
      )}
      style={style}
    >
      {/* Pink background composed from edge SVGs + stretchy fills */}
      <span className="absolute inset-0 flex pointer-events-none" aria-hidden="true">
        <EdgeSvg edgeW={cfg.edgeW} edgePath={cfg.edgePath} />
        <span className="flex-1" style={{ background: PINK }} />
        {cfg.hasCenter && <CenterNotch />}
        <span className="flex-1" style={{ background: PINK }} />
        <EdgeSvg edgeW={cfg.edgeW} edgePath={cfg.edgePath} flip />
      </span>

      {/* Text — sits above the pink background layer */}
      <span
        className="relative px-[14px] font-lore text-[11px] uppercase tracking-wide whitespace-nowrap leading-none"
        style={{ color: TEXT_COLOR }}
      >
        {label}
      </span>
    </Tag>
  )
}
