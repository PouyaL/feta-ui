'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { spring } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './tab-bar.module.css'

const LABEL_S = 0.12
const LABEL_X = -6

export type TabBarItem = { value: string; label: string; icon: ReactNode; href?: string; /** Read out with the label, and shown as a dot. */ badge?: string }

export type TabBarProps = {
  items: TabBarItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** `labeled` is the classic bar. `floating` is a dock whose active tab grows an ink pill. */
  appearance?: 'labeled' | 'floating'
  /** The 134 by 5 bar iOS draws under full width tab bars. */
  homeIndicator?: boolean
  'aria-label'?: string
  animated?: boolean
  className?: string
}

/** Three to five top destinations on Mobile, as a labeled bar or a floating dock. Tabs are links unless they have no `href`. */
export function TabBar({ items, value, defaultValue, onValueChange, appearance = 'labeled', homeIndicator = false, 'aria-label': label = 'Main', animated = true, className }: TabBarProps) {
  const still = useStill(animated)
  const uid = useId()
  const [held, setHeld] = useState(defaultValue ?? items[0]?.value)
  const current = value ?? held
  const floating = appearance === 'floating'

  function choose(next: string): void {
    setHeld(next)
    onValueChange?.(next)
  }

  return (
    <nav aria-label={label} className={cx(styles.bar, className)} data-appearance={appearance}>
      <ul className={styles.list}>
        {items.map((item) => {
          const on = item.value === current
          const shared = {
            className: styles.tab,
            'data-on': on ? '' : undefined,
            'aria-label': item.badge ? `${item.label}, ${item.badge}` : item.label,
            'aria-current': on ? 'page' as const : undefined,
            onClick: () => choose(item.value),
          }
          const body = (
            <>
              {on ? <motion.span {...(still ? {} : { layoutId: `${uid}-pill` })} className={styles.pill} style={{ borderRadius: 9999 }} transition={spring.slide} /> : null}
              <span className={styles.icon}>{item.icon}{item.badge ? <span className={styles.badge} /> : null}</span>
              {floating ? (
                <AnimatePresence initial={false} mode="popLayout">
                  {on ? <motion.span key={item.value} className={styles.label} initial={still ? false : { opacity: 0, x: LABEL_X }} animate={{ opacity: 1, x: 0 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: LABEL_S } }} transition={still ? { duration: 0 } : spring.slide}>{item.label}</motion.span> : null}
                </AnimatePresence>
              ) : <span className={styles.label}>{item.label}</span>}
            </>
          )
          return (
            <motion.li key={item.value} {...(floating && !still ? { layout: 'position' as const } : {})} transition={spring.slide} className={styles.slot} data-on={on ? '' : undefined}>
              {item.href === undefined ? <button type="button" {...shared}>{body}</button> : <a href={item.href} {...shared}>{body}</a>}
            </motion.li>
          )
        })}
      </ul>
      {homeIndicator && !floating ? <span className={styles.home} aria-hidden="true" /> : null}
    </nav>
  )
}
