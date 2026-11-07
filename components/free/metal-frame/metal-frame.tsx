'use client'
import type { CSSProperties, ReactNode } from 'react'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import { MetalRing } from './metal-ring'
import styles from './metal-frame.module.css'

export { MetalRing, type MetalRingProps, type MetalRingTint } from './metal-ring'

/** Bands drift this many times faster while a request is in flight. */
const THINKING_SPEED = 2.5

const watch = (node: HTMLDivElement | null): (() => void) | undefined => (node ? watchOffscreen(node) : undefined)

export type MetalFrameProps = {
  children: ReactNode
  /** Box wraps a surface, Pill a field, Circle an avatar. Default `box`. */
  shape?: 'box' | 'pill' | 'circle'
  /** The request is in flight. The bands run faster and a soft ink glow breathes. */
  thinking?: boolean
  disabled?: boolean
  animated?: boolean
  /** How bright and solid the metal is, 0 to 1. Default 1. */
  strength?: number
  /** The ring's width in px. Default 1.5. */
  ringCssPx?: number
  /** Corner radius in px. Left out, the shape's token radius is used. */
  borderRadius?: number
  /** Holds the reflections still. The bend still follows the pointer. */
  paused?: boolean
  /** Swells the ring toward a mouse pointer. Default true. */
  bend?: boolean
  /** A soft inner shadow under the ring, so the surface reads as set into the metal. Default true. */
  innerShadow?: boolean
  /** Forces the palette. Left out, it follows the theme tokens. */
  theme?: 'light' | 'dark'
  className?: string
  style?: CSSProperties
}

/** Rings any box in liquid chrome. Bands drift round the edge, the edge swells toward the pointer, and thinking runs them faster. */
export function MetalFrame({
  children,
  shape = 'box',
  thinking = false,
  disabled = false,
  animated = true,
  strength = 1,
  ringCssPx = 1.5,
  borderRadius,
  paused = false,
  bend = true,
  innerShadow = true,
  theme,
  className,
  style,
}: MetalFrameProps) {
  const still = useStill(animated)
  const frameStyle = borderRadius === undefined ? style : { ...style, borderRadius }
  return (
    <div
      className={cx(styles.frame, className)}
      data-loop=""
      data-shape={shape}
      data-thinking={thinking ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-still={still ? '' : undefined}
      data-inner-shadow={innerShadow ? '' : undefined}
      style={frameStyle}
    >
      <div ref={thinking ? watch : undefined} className={styles.content}>{children}</div>
      <MetalRing
        still={still || disabled}
        strength={thinking ? 1 : strength}
        speed={thinking ? THINKING_SPEED : 1}
        paused={paused && !thinking}
        bend={bend}
        ringCssPx={ringCssPx}
        borderRadius={borderRadius}
        theme={theme}
      />
    </div>
  )
}
