import type { Preset } from './presets'

// Tokens and presets from docs/ANIMATION.md §2 and §3. Every renderer (React hook,
// playground, docs) reads these specs instead of redefining keyframes.

export const duration = { fast: 0.15, base: 0.3, slow: 0.6 } // seconds

export type CubicBezier = readonly [number, number, number, number]

export const ease = {
  out: [0.23, 1, 0.32, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, CubicBezier>

export type SpringToken = { type: 'spring'; stiffness: number; damping: number }

export const spring = {
  pop: { type: 'spring', stiffness: 500, damping: 15 },
  bounce: { type: 'spring', stiffness: 400, damping: 12 },
} as const satisfies Record<string, SpringToken>

export type AnimatedProp = 'scale' | 'rotate' | 'x' | 'y' | 'scaleY' | 'opacity' | 'pathLength'

export type PresetSpec = {
  /**
   * `svg`: the whole icon. `paths`: every drawable element. `eye`: the eye path (whole svg until tagged).
   * `state`: the state groups of a two-state icon; `keyframes` move the rest state, `active` the second.
   */
  target: 'svg' | 'paths' | 'eye' | 'state'
  /** CSS transform-origin, applied with `transform-box: fill-box`. */
  origin: string
  keyframes: Partial<Record<AnimatedProp, readonly number[]>>
  /** Seconds at speed 1. */
  duration: number
  /** Tween easing, or a spring that settles the last keyframe (Motion springs take two keyframes). */
  ease: CubicBezier | 'linear' | SpringToken
  /** Loops run with a 400 ms pause between runs (ANIMATION.md §5). */
  loop: boolean
  /** `state` only: keyframes for the second state, played alongside `keyframes`. */
  active?: Partial<Record<AnimatedProp, readonly number[]>>
  /** Keyframe offsets from 0 to 1. `state`: [rest, in, hold ends, rest], so a held trigger stretches the hold. */
  times?: readonly number[]
}

export const LOOP_PAUSE = 0.4

/** `swap`: how flat a state folds (scaleY) while the other replaces it. */
export const SWAP_FOLD = 0.2

export const presetSpecs: Record<Preset, PresetSpec> = {
  draw: { target: 'paths', origin: 'center', keyframes: { pathLength: [0, 1], opacity: [0, 1] }, duration: 0.6, ease: ease.inOut, loop: false },
  pop: { target: 'svg', origin: 'center', keyframes: { scale: [1, 1.15, 1] }, duration: 0.32, ease: spring.pop, loop: false },
  wiggle: { target: 'svg', origin: 'top center', keyframes: { rotate: [0, -12, 10, -6, 0] }, duration: 0.5, ease: ease.out, loop: false },
  spin: { target: 'svg', origin: 'center', keyframes: { rotate: [0, 360] }, duration: 0.7, ease: ease.inOut, loop: false },
  bounce: { target: 'svg', origin: 'center', keyframes: { y: [0, -3, 0] }, duration: 0.42, ease: spring.bounce, loop: false },
  slide: { target: 'svg', origin: 'center', keyframes: { x: [0, 3, 0] }, duration: 0.35, ease: ease.out, loop: false },
  pulse: { target: 'svg', origin: 'center', keyframes: { scale: [1, 1.08, 1], opacity: [1, 0.8, 1] }, duration: 1.2, ease: ease.inOut, loop: true },
  shake: { target: 'svg', origin: 'center', keyframes: { x: [0, -2, 2, -2, 2, 0] }, duration: 0.4, ease: 'linear', loop: false },
  blink: { target: 'eye', origin: 'center', keyframes: { scaleY: [1, 0.1, 1] }, duration: 0.26, ease: ease.inOut, loop: false },
  float: { target: 'svg', origin: 'center', keyframes: { y: [0, -1.5, 0] }, duration: 2, ease: ease.inOut, loop: true },
  // Two-state icons: the rest state folds flat as the second state opens out of it, holds, then
  // folds back. In 180 ms, hold 840 ms (or exactly as long as a held hover or focus trigger), out 180 ms.
  swap: {
    target: 'state', origin: 'center', duration: 1.2, ease: ease.out, loop: false,
    keyframes: { opacity: [1, 0, 0, 1], scaleY: [1, SWAP_FOLD, SWAP_FOLD, 1] },
    active: { opacity: [0, 1, 1, 0], scaleY: [SWAP_FOLD, 1, 1, SWAP_FOLD] },
    times: [0, 0.15, 0.85, 1],
  },
}

/** Reduced motion replaces every preset with a 150 ms opacity cue (ANIMATION.md §6). */
export const reducedMotionSpec: PresetSpec = {
  target: 'svg', origin: 'center', keyframes: { opacity: [0.6, 1] }, duration: duration.fast, ease: 'linear', loop: false,
}

const BACKWARD_WORDS = ['left', 'previous', 'back', 'backward', 'prev']

/** `slide` follows the arrow: icons that point back slide left (ANIMATION.md §3). */
export function slideDirection(icon: string): 1 | -1 {
  return icon.split('-').some((t) => BACKWARD_WORDS.includes(t)) ? -1 : 1
}
