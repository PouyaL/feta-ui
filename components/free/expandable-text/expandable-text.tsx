'use client'
import { Children, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './expandable-text.module.css'

const UNROLL_MS = 320
const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)'

export type ExpandableTextProps = {
  /** One `<p>` per paragraph. Every paragraph stays in the DOM, so screen readers read it all. */
  children: ReactNode
  /** Lines shown while collapsed. Default 3. */
  lines?: number
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  moreLabel?: string
  lessLabel?: string
  /** Spoken in place of Read more. */
  moreAriaLabel?: string
  animated?: boolean
  className?: string
}

/** Copy longer than three lines. It clamps on a line boundary and unrolls where you were reading. */
export function ExpandableText({ children, lines = 3, defaultOpen = false, onOpenChange, moreLabel = 'Read more', lessLabel = 'Read less', moreAriaLabel = 'Show the full description', animated = true, className }: ExpandableTextProps) {
  const still = useStill(animated)
  const box = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(defaultOpen)
  const [closing, setClosing] = useState(false)
  const [fits, setFits] = useState(false)

  const clampHeight = (node: HTMLElement): number => parseFloat(getComputedStyle(node).lineHeight) * lines

  useLayoutEffect(() => {
    const node = box.current
    if (!node) return
    const measure = (): void => {
      const first = node.firstElementChild
      const more = Children.count(children) > 1
      setFits(!more && (first ? first.scrollHeight <= clampHeight(node) + 1 : true))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [children, lines])

  function toggle(): void {
    const node = box.current
    if (!node) return
    const next = !open
    onOpenChange?.(next)
    if (still) { setOpen(next); return }
    const height = clampHeight(node)
    if (next) {
      setOpen(true)
      requestAnimationFrame(() => node.animate([{ height: `${height}px` }, { height: `${node.offsetHeight}px` }], { duration: UNROLL_MS, easing: EASE_OUT }))
      return
    }
    setClosing(true)
    setOpen(false)
    const motion = node.animate([{ height: `${node.offsetHeight}px` }, { height: `${height}px` }], { duration: UNROLL_MS, easing: EASE_OUT })
    motion.onfinish = () => setClosing(false)
    motion.oncancel = () => setClosing(false)
  }

  const clamped = !open && !closing && !fits
  return (
    <div className={cx(styles.root, className)} data-open={open ? '' : undefined}>
      <div ref={box} className={styles.text} data-clamped={clamped ? '' : undefined} style={{ '--lines': lines } as CSSProperties}>{children}</div>
      {fits ? null : (
        <span className={styles.toggle}>
          <Button
            variant="ghost"
            size="sm"
            animated={animated}
            aria-expanded={open}
            aria-label={open ? undefined : moreAriaLabel}
            trailingIcon={<span className={styles.chevron}><ChevronUpIcon /></span>}
            onClick={toggle}
          >
            {open ? lessLabel : moreLabel}
          </Button>
        </span>
      )}
    </div>
  )
}
