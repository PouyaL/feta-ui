'use client'
import { useCallback, useEffect, useId, useRef, type RefObject } from 'react'
import { holdOnHover, holdsState } from './hover-hold'
import { claim, isActive, release, subscribe } from './loop-coordinator'
import { LOOP_PAUSE_MS, playIcon, prefersReducedMotion, stopIcon } from './play'
import type { IconHandle, Preset, Style, Trigger } from './types'

type Options = { preset: Preset; style: Style; dir: 1 | -1; speed: number; trigger: Trigger; name: string }

const INTERACTIVE = 'a,button,[tabindex]'

/** Wires one icon's trigger and returns its imperative handle (ANIMATION.md §5). */
export function useIconAnimation(svg: RefObject<SVGSVGElement | null>, opts: Options): IconHandle {
  const { preset, style, dir, speed, trigger, name } = opts
  const id = useId()
  const playing = useRef(false)

  const startAnimation = useCallback(() => {
    const el = svg.current
    if (!el || playing.current) return
    playing.current = true
    void playIcon(el, { preset, style, dir, speed }).finally(() => { playing.current = false })
  }, [svg, preset, style, dir, speed])

  const stopAnimation = useCallback(() => {
    const el = svg.current
    if (el) void stopIcon(el)
  }, [svg])

  useEffect(() => {
    const el = svg.current
    if (!el || trigger === 'none') return
    if (trigger === 'hover' && holdsState(preset)) {
      // Swap holds its second state while the pointer or keyboard focus stays (ANIMATION.md §5).
      const target = el.closest(INTERACTIVE) ?? el
      return holdOnHover(target, async (held) => {
        if (playing.current) return
        playing.current = true
        try { await playIcon(el, { preset, style, dir, speed, held }) } finally { playing.current = false }
      })
    }
    if (trigger === 'hover' || trigger === 'click') {
      const target = el.closest(INTERACTIVE) ?? el
      const play = (): void => startAnimation()
      // Only with a real control: a focus listener on a bare svg makes Chromium add it to the Tab order.
      const events = trigger !== 'hover' ? ['pointerdown'] : target === el ? ['pointerenter'] : ['pointerenter', 'focusin']
      for (const e of events) target.addEventListener(e, play)
      return () => { for (const e of events) target.removeEventListener(e, play) }
    }
    if (trigger === 'inView') {
      const seen = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return
        startAnimation()
        seen.disconnect()
      }, { threshold: 0.5 })
      seen.observe(el)
      return () => seen.disconnect()
    }
    let timer: ReturnType<typeof setTimeout> | undefined
    let alive = true
    let cued = false
    const tick = (): void => {
      timer = undefined
      if (!alive || !isActive(id)) return
      // Another run is in flight, from a release and reclaim or from startAnimation. One run at a time.
      if (playing.current) { timer = setTimeout(tick, LOOP_PAUSE_MS); return }
      // Reduced motion: one cue, then the icon stays at rest.
      if (prefersReducedMotion()) {
        if (cued) return
        cued = true
      }
      playing.current = true
      void playIcon(el, { preset, style, dir, speed }).finally(() => {
        playing.current = false
        if (!alive || !isActive(id)) return
        clearTimeout(timer)
        timer = setTimeout(tick, LOOP_PAUSE_MS)
      })
    }
    const resume = (): void => { if (isActive(id) && timer === undefined) { timer = setTimeout(tick, 0) } }
    const unsubscribe = subscribe(() => { if (!isActive(id)) { clearTimeout(timer); timer = undefined } else resume() })
    const visible = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) claim(id, name)
      else release(id)
    }, { threshold: 0.5 })
    visible.observe(el)
    return () => {
      alive = false
      clearTimeout(timer)
      visible.disconnect()
      unsubscribe()
      release(id)
    }
  }, [svg, trigger, id, name, preset, style, dir, speed, startAnimation])

  return { startAnimation, stopAnimation }
}
