'use client'
import { motion } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronLeftIcon } from '@fetaui/react/rounded/chevron-left'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { spring } from '../../motion-tokens'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './lens-pager.module.css'

/** Sideways distance between numbers on the strip. */
const SLOT = 64
/** 20 over 30: a neighbour is the current number at this scale, and Light in weight. */
const NEIGHBOUR_SCALE = 2 / 3

export type LensPagerProps = {
  pages: number
  page?: number
  defaultPage?: number
  onPageChange?: (page: number) => void
  'aria-label'?: string
  animated?: boolean
  className?: string
}

/** Paging through a lens, for moments where paging is the point. The strip rolls one number at a time. */
export function LensPager({ pages, page, defaultPage = 1, onPageChange, 'aria-label': label = 'Pagination', animated = true, className }: LensPagerProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultPage)
  const [warm, setWarm] = useState(false)
  const root = useRef<HTMLElement>(null)
  const pressed = useRef<Element | null>(null)
  const current = page ?? held

  // An arrow that turns disabled drops focus, so it passes to the other one and the keys keep working.
  useEffect(() => {
    if (pressed.current?.matches(':disabled')) root.current?.querySelector<HTMLElement>('button:not(:disabled)')?.focus()
    pressed.current = null
  }, [current])

  function go(next: number): void {
    pressed.current = document.activeElement
    const target = Math.max(1, Math.min(pages, next))
    setHeld(target)
    onPageChange?.(target)
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>): void {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1) }
  }

  return (
    <nav ref={root} aria-label={label} className={cx(styles.tray, className)} data-still={still ? '' : undefined} onKeyDown={onKeyDown}>
      <IconButton variant="secondary" size="sm" className={cx(styles.arrow)} label="Previous page" icon={<ChevronLeftIcon />} animated={animated} disabled={current <= 1} onClick={() => go(current - 1)} />
      <div className={styles.lens}>
        <span className={styles.rule} data-side="top" aria-hidden="true" />
        <span className={styles.rule} data-side="bottom" aria-hidden="true"><span className={styles.notch} /></span>
        <span className={styles.mark} data-side="left" aria-hidden="true" />
        <span className={styles.mark} data-side="right" aria-hidden="true" />
        <div className={styles.window} aria-hidden="true">
          {/* Page 0 is the ghost before the first page, as in the Default state. */}
          {Array.from({ length: pages + 1 }, (_, n) => n).map((n) => {
            const away = n - current
            return (
              <motion.span
                key={n}
                className={styles.number}
                data-on={away === 0 ? '' : undefined}
                data-warm={warm && away === 1 ? '' : undefined}
                initial={false}
                animate={{ x: away * SLOT, scale: away === 0 ? 1 : NEIGHBOUR_SCALE, opacity: Math.abs(away) <= 1 ? 1 : 0 }}
                transition={still ? { duration: 0 } : spring.slide}
              >
                {n}
              </motion.span>
            )
          })}
        </div>
        <span aria-live="polite" className={styles.count}>{current} of {pages}</span>
      </div>
      <IconButton variant="secondary" size="sm" className={cx(styles.arrow)} label="Next page" icon={<ChevronRightIcon />} animated={animated} disabled={current >= pages} data-warm={warm ? '' : undefined} onClick={() => go(current + 1)} onPointerEnter={() => setWarm(true)} onPointerLeave={() => setWarm(false)} />
    </nav>
  )
}
