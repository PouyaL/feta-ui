import type { Ref } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

// Declared here, not imported, so the published types never point at private packages.
// The same unions as @fetaui/react; tools/native/icons.test.tsx fails if these drift from core.
export type Preset = 'draw' | 'pop' | 'wiggle' | 'spin' | 'bounce' | 'slide' | 'pulse' | 'shake' | 'blink' | 'float' | 'swap'
export type Style = 'rounded' | 'outlined' | 'filled' | 'sharp' | 'two-tone' | 'hand-drawn' | 'riso' | 'pixel' | 'glass' | 'neon'
/**
 * `hover` plays when a pointer enters (iPad, web) or a finger lands on the icon. `click` plays on press. `inView`
 * plays once after the icon first lays out. `loop` repeats, one looping icon at a time (FetaProvider maxLoops).
 */
export type Trigger = 'hover' | 'loop' | 'click' | 'inView' | 'none'

export type IconHandle = {
  startAnimation: () => void
  /** Returns to the rest pose. */
  stopAnimation: () => void
}

/** One element: [tag, props, children]. Props ending in `$` are runtime metadata from the generator. */
export type IconTreeNode = readonly [tag: string, props: Readonly<Record<string, string | number>>, children?: IconTree]
export type IconTree = readonly IconTreeNode[]

export type IconProps = {
  /** Default 24. */
  size?: number
  /** Default the fetaUI ink, #141812. Neon recolors its glow instead. */
  color?: string
  /** Default `hover`. `trigger` always wins, even with a ref. */
  trigger?: Trigger
  /** Default `draw`. */
  preset?: Preset
  /** Multiplier, default 1. 2 plays twice as fast. */
  speed?: number
  /** Names the icon for screen readers. Without it the icon is hidden from them. */
  'aria-label'?: string
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  testID?: string
  ref?: Ref<IconHandle>
}
