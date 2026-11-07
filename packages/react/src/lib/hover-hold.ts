'use client'
import { presetSpecs } from '@fetaui/core/motion'
import type { Preset } from './types'

/** True for presets that hold their second state while the trigger lasts (`swap`, ANIMATION.md §3). */
export const holdsState = (preset: Preset): boolean => presetSpecs[preset].target === 'state'

/** Keyboard focus on `target` or inside it. Focus from a mouse press does not count: the pointer already does. */
function keyboardFocus(target: Element): boolean {
  try {
    return target.matches(':focus-visible, :has(:focus-visible)')
  } catch {
    return target.matches(':focus-within')
  }
}

/**
 * Hover trigger for a held preset. Pointer enter or keyboard focus on `target` plays it, and the
 * second state holds until the pointer has left and focus has moved away. If the pointer comes back
 * while the icon returns to rest, it plays again once it is there. A touch is a tap: it plays once
 * without holding. `play` resolves at rest. Returns cleanup.
 */
export function holdOnHover(target: Element, play: (held: Promise<void>) => Promise<void>): () => void {
  let pointer = false
  let focus = false
  let running = false
  let release: (() => void) | null = null
  /** Set when the trigger comes back after a release, so the run that is ending plays again. */
  let again = false

  const engaged = (): boolean => pointer || focus
  const start = (): void => {
    if (running) {
      if (!release) again = true
      return
    }
    running = true
    again = false
    const held = new Promise<void>((resolve) => { release = resolve })
    if (!engaged()) release?.()
    void play(held).finally(() => {
      running = false
      release = null
      if (again && engaged()) start()
    })
  }
  const settle = (): void => {
    if (engaged() || !release) return
    release()
    release = null
  }

  const enter = (event: Event): void => {
    pointer = (event as PointerEvent).pointerType !== 'touch'
    start()
  }
  const leave = (): void => { pointer = false; settle() }
  const focusIn = (): void => {
    focus = keyboardFocus(target)
    if (focus) start()
  }
  // Focus moving to another element inside the target keeps the hold.
  const focusOut = (event: Event): void => {
    const next = (event as FocusEvent).relatedTarget
    if (next instanceof Node && target.contains(next)) return
    focus = false
    settle()
  }

  target.addEventListener('pointerenter', enter)
  target.addEventListener('pointerleave', leave)
  target.addEventListener('focusin', focusIn)
  target.addEventListener('focusout', focusOut)
  return () => {
    target.removeEventListener('pointerenter', enter)
    target.removeEventListener('pointerleave', leave)
    target.removeEventListener('focusin', focusIn)
    target.removeEventListener('focusout', focusOut)
    release?.()
  }
}
