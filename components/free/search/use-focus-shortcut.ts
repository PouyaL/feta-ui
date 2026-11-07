'use client'
import { useEffect, type RefObject } from 'react'

/** Fields that want ⌘ K, newest last. Only one answers, so several on a page never fight. */
const claims: symbol[] = []
let listening = false
const owners = new Map<symbol, RefObject<HTMLInputElement | null>>()

function onKey(e: KeyboardEvent): void {
  if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'k') return
  // The newest field that is on screen and enabled takes the focus.
  for (let i = claims.length - 1; i >= 0; i--) {
    const claim = claims[i]
    const input = claim ? owners.get(claim)?.current : null
    if (!input || input.disabled || input.getClientRects().length === 0) continue
    e.preventDefault()
    input.focus()
    return
  }
}

/** Focuses `input` on ⌘ K or Ctrl K. With several fields mounted, the newest visible one wins. */
export function useFocusShortcut(input: RefObject<HTMLInputElement | null>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    const claim = Symbol('shortcut')
    claims.push(claim)
    owners.set(claim, input)
    if (!listening) { window.addEventListener('keydown', onKey); listening = true }
    return () => {
      claims.splice(claims.indexOf(claim), 1)
      owners.delete(claim)
      if (!claims.length && listening) { window.removeEventListener('keydown', onKey); listening = false }
    }
  }, [enabled, input])
}
