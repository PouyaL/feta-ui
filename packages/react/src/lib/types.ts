import type { Ref, SVGProps } from 'react'

// Declared here, not imported, so the published types never point at private packages.
// src/lib/types.test.ts fails if these drift from core.
export type Preset = 'draw' | 'pop' | 'wiggle' | 'spin' | 'bounce' | 'slide' | 'pulse' | 'shake' | 'blink' | 'float' | 'swap'
export type Style = 'rounded' | 'outlined' | 'filled' | 'sharp' | 'two-tone' | 'hand-drawn' | 'riso' | 'pixel' | 'glass' | 'neon'
export type Trigger = 'hover' | 'loop' | 'click' | 'inView' | 'none'

export type IconHandle = {
  startAnimation: () => void
  /** Returns to the rest pose. */
  stopAnimation: () => void
}

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'color' | 'ref'> & {
  /** Default 24. */
  size?: number
  /** Default `currentColor`. Neon recolors its glow instead. */
  color?: string
  /** Default `hover`. `trigger` always wins, even with a ref (ANIMATION.md §5). */
  trigger?: Trigger
  /** Default `draw`. */
  preset?: Preset
  /** Multiplier, default 1. 2 plays twice as fast. */
  speed?: number
  ref?: Ref<IconHandle>
}
