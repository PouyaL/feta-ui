import type { KeyboardEvent } from 'react'

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

/** The element arrow keys, Home and End should move focus to, or null for any other key. */
export function rovingTarget(e: KeyboardEvent<HTMLElement>): HTMLElement | null {
  const group = e.currentTarget.closest('[data-roving-group]')
  if (!group) return null
  const items = [...group.querySelectorAll<HTMLElement>('[data-roving]:not(:disabled)')]
  const at = items.indexOf(e.currentTarget)
  if (e.key === 'Home') return items[0] ?? null
  if (e.key === 'End') return items.at(-1) ?? null
  const step = STEP[e.key]
  if (!step) return null
  return items[(at + step + items.length) % items.length] ?? null
}
