'use client'
import { animate, useMotionValue, useTransform, type HTMLMotionProps, type MotionValue, type PanInfo } from 'motion/react'
import { useEffect, useState } from 'react'
import { spring } from '../../motion-tokens'

const FLY_OUT_S = 0.2
const FADE_AT = 0.7

/** Swipe sideways to dismiss, on touch only. The card follows the finger and fades. */
export function useSwipe(enabled: boolean, share: number, still: boolean, onDismiss: () => void): { props: HTMLMotionProps<'div'>; x: MotionValue<number> } {
  const [touch, setTouch] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    setTouch(query.matches)
    const update = (): void => setTouch(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  const x = useMotionValue(0)
  const opacity = useTransform(x, (value) => {
    const width = typeof window === 'undefined' ? 400 : Math.min(window.innerWidth, 400)
    return 1 - Math.min(Math.abs(value) / (width * FADE_AT), 1)
  })
  function onDragEnd(event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo): void {
    const node = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-swipe]') : null
    const width = node?.offsetWidth ?? 360
    if (Math.abs(info.offset.x) < width * share) {
      void animate(x, 0, spring.slide)
      return
    }
    if (still) { onDismiss(); return }
    void animate(x, Math.sign(info.offset.x) * width * 1.2, { duration: FLY_OUT_S, onComplete: onDismiss })
  }
  if (!enabled || !touch) return { props: {}, x }
  return { props: { drag: 'x', dragMomentum: false, dragElastic: 1, dragConstraints: { left: 0, right: 0 }, style: { x, opacity }, onDragEnd, 'data-swipe': '' } as HTMLMotionProps<'div'>, x }
}
