'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { duration, ease, scalePress, spring } from '../../motion-tokens'
import { useLabelMotion } from '../button/label-motion'
import { DropdownMenu, isCompact, safeHref } from '../dropdown-menu/dropdown-menu'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Skeleton } from '../skeleton/skeleton'
import styles from './breadcrumb.module.css'

const ENTER_X = 8
const MAX_CRUMBS = 4
const COMPACT_CRUMBS = 3

export type BreadcrumbItem = {
  label: string
  href?: string
  icon?: ReactNode
  /** Fires on a click, or on Enter or Space, both as a crumb and from the folded menu, where each level is a real link too. Call `preventDefault()` to route on the client. */
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void
}

export type BreadcrumbSeparatorProps = { type?: 'chevron' | 'slash' | 'dot'; size?: 'sm' | 'md' }

/** Decorative, so it stays out of the accessibility tree. */
export function BreadcrumbSeparator({ type = 'chevron', size = 'md' }: BreadcrumbSeparatorProps) {
  return (
    <span className={styles.separator} data-size={size} aria-hidden="true">
      {type === 'chevron' ? <ChevronRightIcon /> : type === 'slash' ? '/' : <span className={styles.dot} />}
    </span>
  )
}

/** Every folded level gets an `href` (`#` when it has none or a blocked scheme, which never navigates), so the menu renders it as an anchor and the click is an anchor click, as on a crumb. */
function selectFolded(item: BreadcrumbItem, e: MouseEvent<HTMLElement>): void {
  if (safeHref(item.href) === '#') e.preventDefault()
  item.onClick?.(e as MouseEvent<HTMLAnchorElement>)
}

function Crumb({ item, still }: { item: BreadcrumbItem; still: boolean }) {
  const text = useLabelMotion(item.label, !still)
  return (
    <motion.a
      href={safeHref(item.href)}
      className={styles.link}
      data-icon-only={item.icon ? '' : undefined}
      aria-label={item.icon ? item.label : undefined}
      onClick={(e) => { if (safeHref(item.href) === '#') e.preventDefault(); item.onClick?.(e) }}
      onPointerEnter={text.handlers.onPointerEnter}
      onPointerLeave={text.handlers.onPointerLeave}
      onPointerDown={text.handlers.onPointerDown}
      onKeyDown={text.handlers.onKeyDown}
      {...(still ? {} : { whileTap: { scale: scalePress } })}
      transition={spring.press}
    >
      {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
      <span className={styles.linkLabel}>{text.label}</span>
    </motion.a>
  )
}

export type BreadcrumbProps = {
  /** From the root to the current page. The last item is the current page. */
  items: BreadcrumbItem[]
  /** `tray` lifts the path onto a tray, with the current page as a chip. Default `plain`. */
  appearance?: 'plain' | 'tray'
  size?: 'sm' | 'md'
  separator?: BreadcrumbSeparatorProps['type']
  /** Holds the current page's place with a skeleton. */
  loading?: boolean
  /** Longer paths fold their middle into a menu, as does any path too wide to fit. */
  maxItems?: number
  'aria-label'?: string
  animated?: boolean
  className?: string
}

/** Shows where the current page sits. New crumbs slide in and the current chip glides to its spot. */
export function Breadcrumb({ items, appearance = 'plain', size = 'md', separator = 'chevron', loading = false, maxItems = MAX_CRUMBS, 'aria-label': label = 'Breadcrumb', animated = true, className }: BreadcrumbProps) {
  const still = useStill(animated)
  const uid = useId()
  const list = useRef<HTMLOListElement>(null)
  const needed = useRef(0)
  const [narrow, setNarrow] = useState(false)
  const [compact, setCompact] = useState(false)

  // Folding is decided by width, not count. The width it took to fit is kept to know when to unfold.
  useLayoutEffect(() => {
    const node = list.current
    if (!node) return
    const measure = (): void => {
      setCompact(isCompact(node))
      const { clientWidth, scrollWidth } = node
      if (scrollWidth > clientWidth) { needed.current = scrollWidth; setNarrow(true) }
      else if (clientWidth >= needed.current) setNarrow(false)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const limit = Math.min(maxItems, compact ? COMPACT_CRUMBS : maxItems)
  const fold = items.length > 2 && (narrow || items.length > limit)
  const head = fold ? items.slice(0, 1) : items.slice(0, -1)
  const hidden = fold ? items.slice(1, -2) : []
  const tail = fold ? items.slice(hidden.length ? -2 : 1, -1) : []
  const current = items.at(-1)
  const links = [...head, ...tail]

  const fade = still ? { duration: 0 } : { duration: duration.base, ease: ease.out }
  const gap = <BreadcrumbSeparator type={separator} size={size} />

  return (
    <nav aria-label={label} className={cx(styles.breadcrumb, className)} data-appearance={appearance} data-size={size} data-still={still ? '' : undefined}>
      <ol ref={list} className={styles.list}>
        <AnimatePresence initial={false} mode="popLayout">
          {links.map((item, index) => (
            <motion.li
              key={item.href ?? item.label}
              className={styles.item}
              initial={still ? false : { opacity: 0, x: ENTER_X }}
              animate={{ opacity: 1, x: 0 }}
              exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: ENTER_X, transition: { duration: duration.fast, ease: ease.out } }}
              transition={fade}
            >
              {index === head.length && hidden.length ? (
                <>
                  <DropdownMenu
                    label="Hidden levels"
                    animated={animated}
                    entries={hidden.map((level) => ({ label: level.label, href: safeHref(level.href), onSelect: (e) => selectFolded(level, e) }))}
                    trigger={(props) => <IconButton {...props} variant="ghost" size={size} label="Show hidden levels" icon={<MoreHorizontalIcon />} animated={animated} />}
                  />
                  {gap}
                </>
              ) : null}
              <Crumb item={item} still={still} />
              {gap}
            </motion.li>
          ))}
          {current ? (
            <li key="current" className={styles.item}>
              <span className={styles.current} aria-current="page">
                {appearance === 'tray' && !loading ? <motion.span {...(still ? {} : { layoutId: `${uid}-chip` })} className={styles.chip} style={{ borderRadius: 9999 }} transition={spring.slide} /> : null}
                {loading ? <><Skeleton width={72} height={12} animated={!still} /><span className={styles.srOnly}>{current.label}, loading</span></> : (
                  <motion.span key={current.label} className={styles.currentLabel} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>{current.label}</motion.span>
                )}
              </span>
            </li>
          ) : null}
        </AnimatePresence>
      </ol>
    </nav>
  )
}
