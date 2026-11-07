'use client'
import { AnimatePresence, animate, motion, useMotionValue, type MotionStyle } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Menu01Icon } from '@fetaui/react/rounded/menu-01'
import { XIcon } from '@fetaui/react/rounded/x'
import { duration, ease } from '../../motion-tokens'
import { isCompact } from '../dropdown-menu/dropdown-menu'
import { useDismiss } from '../form-kit/use-dismiss'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { NavItem } from '../sidebar/sidebar'
import styles from './navigation-menu.module.css'

const PANEL_S = 0.2
const CLOSE_DELAY_MS = 160
const EDGE_GAP = 8

export type NavigationLink = { title: string; description?: string; href: string; icon?: ReactNode }

export type NavigationEntry = {
  label: string
  href?: string
  /** Width of the panel on Web. Default 480. */
  width?: number
  /** A tile beside the links, like a feature. */
  feature?: ReactNode
  /** Mono heading over the grid, like `COMPONENTS`. */
  heading?: ReactNode
  links?: NavigationLink[]
  /** Columns of links. Default 1. */
  columns?: 1 | 2
  /** A row under the panel, like a version and a changelog link. */
  footer?: ReactNode
}

export type NavigationMenuProps = {
  items: NavigationEntry[]
  /** Logo at the start of the bar. */
  brand?: ReactNode
  /** The end of the bar, like Sign in. On Mobile it sits in the menu's footer. */
  end?: ReactNode
  /** A search field. Before `end` on Web, and across the top of the menu on Mobile. */
  search?: ReactNode
  /** A short note in the Mobile menu's footer, like a version. */
  meta?: ReactNode
  /** Opens the Mobile menu on mount. `defaultOpen` opens it too. */
  defaultExpanded?: boolean
  'aria-label'?: string
  /** Opens this entry on mount. */
  defaultOpen?: string
  animated?: boolean
  className?: string
}

const DEFAULT_WIDTH = 480

/*
 * One panel open across the page. Opening a menu closes every other one. A menu that opens by
 * `defaultOpen` while another is already open stays closed, so two showcases never overlap.
 */
const menus = new Map<string, () => void>()
let owner: string | null = null

function claim(id: string): void {
  owner = id
  menus.forEach((shut, key) => { if (key !== id) shut() })
}

// On Web a pointer has already opened the panel by hovering, so its click keeps it open. Keys and touch toggle.
function Panel({ item, compact = false }: { item: NavigationEntry; compact?: boolean }) {
  return (
    <>
    <div className={styles.content} data-feature={item.feature && !compact ? '' : undefined}>
      {item.feature && !compact ? <div className={styles.feature}>{item.feature}</div> : null}
      <div className={styles.linksWrap}>
        {item.heading ? <div className={styles.heading}>{item.heading}</div> : null}
        <ul className={styles.links} data-columns={item.columns ?? 1}>
          {item.links?.map((link) => (
            <li key={link.href}>
              <a href={link.href} className={styles.link}>
                {link.icon ? <span className={styles.linkIcon}>{link.icon}</span> : null}
                <span className={styles.linkBody}>
                  <span className={styles.linkTitle}>{link.title}</span>
                  {link.description ? <span className={styles.linkText}>{link.description}</span> : null}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
    {item.footer && !compact ? <div className={styles.panelFooter}>{item.footer}</div> : null}
    </>
  )
}

/** A tray pill of triggers with soft panels. Moving across triggers morphs one panel, with no close in between. */
export function NavigationMenu({ items, brand, end, search, meta, defaultExpanded = false, 'aria-label': label = 'Main', defaultOpen, animated = true, className }: NavigationMenuProps) {
  const still = useStill(animated)
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pointer = useRef('')
  const bar = useRef<HTMLElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<string | null>(defaultOpen ?? null)
  const [compact, setCompact] = useState(false)
  /** The Mobile menu under the top bar. */
  const [sheet, setSheet] = useState(defaultExpanded || defaultOpen !== undefined)
  const toggle = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(null), [])
  useDismiss(root, open !== null, close)
  const x = useMotionValue(0)
  // The panel morphs between widths and heights by scaling its surface, never by animating width.
  const scaleX = useMotionValue(1)
  const scaleY = useMotionValue(1)
  const size = useRef<{ w: number; h: number } | null>(null)
  const wasOpen = useRef(false)
  /** The one line width of the bar, measured while it is not collapsed. */
  const needed = useRef(0)
  /** Still the `defaultOpen` panel, not one a person opened. */
  const fromDefault = useRef(defaultOpen !== undefined)
  const current = items.find((item) => item.label === open)
  const panelId = `${uid}-panel`
  const sheetId = `${uid}-menu`

  useEffect(() => {
    menus.set(uid, close)
    return () => { menus.delete(uid); if (owner === uid) owner = null }
  }, [uid, close])

  useEffect(() => {
    if (open === null) { if (owner === uid) owner = null; return }
    if (fromDefault.current && owner !== null && owner !== uid) { setOpen(null); return }
    claim(uid)
  }, [open, uid])

  const choose = (next: string | null): void => {
    fromDefault.current = false
    setOpen(next)
  }

  // Collapse to the Mobile menu on a phone, or on Web when the bar no longer fits on one line.
  useLayoutEffect(() => {
    const node = root.current
    const host = node?.parentElement
    if (!node || !host) return
    const measure = (): void => {
      if (isCompact(node)) { setCompact(true); return }
      const line = bar.current
      if (line && node.dataset.compact === undefined) needed.current = Math.ceil(line.scrollWidth)
      const style = getComputedStyle(host)
      const room = host.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      setCompact(needed.current > room + 0.5)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    if (bar.current) observer.observe(bar.current)
    measure()
    return () => observer.disconnect()
  }, [compact])

  useEffect(() => () => clearTimeout(timer.current), [])

  useLayoutEffect(() => {
    const node = root.current
    if (!node || !current || compact) { wasOpen.current = false; return }
    const trigger = node.querySelector<HTMLElement>(`[data-entry="${CSS.escape(current.label)}"]`)
    const target = Math.min(current.width ?? DEFAULT_WIDTH, window.innerWidth - 2 * EDGE_GAP)
    const nodeBox = node.getBoundingClientRect()
    const frame = node.closest('[data-platform]')?.getBoundingClientRect()
    const right = Math.min(frame?.right ?? window.innerWidth, window.innerWidth) - EDGE_GAP
    const left = (frame?.left ?? 0) + EDGE_GAP
    const wanted = trigger ? trigger.getBoundingClientRect().left : nodeBox.left
    const place = Math.max(left, Math.min(wanted, right - target)) - nodeBox.left
    const box = viewport.current
    const next = { w: box?.offsetWidth ?? target, h: box?.offsetHeight ?? 0 }
    const last = size.current
    if (wasOpen.current && !still && last && next.w > 0 && next.h > 0) {
      animate(x, place, { duration: PANEL_S, ease: ease.out })
      scaleX.set(last.w / next.w)
      scaleY.set(last.h / next.h)
      animate(scaleX, 1, { duration: PANEL_S, ease: ease.out })
      animate(scaleY, 1, { duration: PANEL_S, ease: ease.out })
    } else {
      x.set(place)
      scaleX.set(1)
      scaleY.set(1)
    }
    size.current = next
    wasOpen.current = true
  }, [current, compact, still, x, scaleX, scaleY])

  // Touch fires enter and leave too, and it must not open or close anything.
  function enter(e: PointerEvent<HTMLLIElement>, item: NavigationEntry): void {
    if (e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    if (item.links) { if (!compact) choose(item.label) } else if (!compact) choose(null)
  }

  function leave(e: PointerEvent<HTMLDivElement>): void {
    if (compact || e.pointerType !== 'mouse') return
    clearTimeout(timer.current)
    timer.current = setTimeout(close, CLOSE_DELAY_MS)
  }

  const triggerOf = (name: string): HTMLElement | null | undefined => root.current?.querySelector<HTMLElement>(`[data-entry="${CSS.escape(name)}"] button`)

  /** The panel sits after the whole bar, so Tab steps into it from its trigger and back out to the next one. */
  function onTab(e: KeyboardEvent<HTMLDivElement>, name: string): void {
    const panel = document.getElementById(panelId)
    const trigger = triggerOf(name)
    if (compact || !panel || !trigger) return
    const stops = [...panel.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')]
    const bar = [...(root.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)') ?? [])].filter((node) => !panel.contains(node))
    let target: HTMLElement | null | undefined
    if (e.target === trigger && !e.shiftKey) target = stops[0]
    else if (e.target === stops[0] && e.shiftKey) target = trigger
    else if (e.target === stops.at(-1) && !e.shiftKey) target = bar[bar.indexOf(trigger) + 1]
    if (!target) return
    e.preventDefault()
    target.focus()
    if (!panel.contains(target) && target !== trigger) close()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    if (compact) { onCompactKey(e); return }
    if (!open) return
    if (e.key === 'Tab') onTab(e, open)
    if (e.key !== 'Escape') return
    e.preventDefault()
    triggerOf(open)?.focus()
    close()
  }

  /** Escape folds the open section back to its row, then closes the menu back to its toggle. */
  function onCompactKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'Escape' || (!open && !sheet)) return
    e.preventDefault()
    if (open) { triggerOf(open)?.focus(); close(); return }
    setSheet(false)
    toggle.current?.focus()
  }

  function onBlur(e: FocusEvent<HTMLDivElement>): void {
    if (e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) close()
  }

  if (compact) {
    const fade = { duration: still ? 0 : PANEL_S, ease: ease.out }
    return (
      <div ref={root} className={cx(styles.root, className)} data-compact="" onKeyDown={onKeyDown}>
        <nav aria-label={label} className={styles.mobile}>
          <div className={styles.topBar}>
            {brand ? <span className={styles.brand}>{brand}</span> : <span />}
            <IconButton ref={toggle} variant="secondary" size="md" animated={animated} label={sheet ? 'Close menu' : 'Open menu'} icon={sheet ? <XIcon /> : <Menu01Icon />} aria-expanded={sheet} aria-controls={sheet ? sheetId : undefined} onClick={() => { if (sheet) close(); setSheet(!sheet) }} />
          </div>
          <AnimatePresence initial={false}>
            {sheet ? (
              <motion.div key="menu" id={sheetId} className={styles.sheet} initial={still ? { opacity: 1 } : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, transition: { duration: duration.close } }} transition={fade}>
                {search ? <div className={styles.sheetSearch}>{search}</div> : null}
                <ul className={styles.sheetCard}>
                  {items.map((item) => (
                    <li key={item.label} data-entry={item.label}>
                      {item.links ? (
                        <NavItem label={item.label} chevron open={open === item.label} controls={open === item.label ? panelId : undefined} animated={animated} className={cx(styles.section)} onClick={() => choose(open === item.label ? null : item.label)} />
                      ) : <NavItem label={item.label} href={item.href} animated={animated} className={cx(styles.section)} />}
                      {item.links && open === item.label ? (
                        <motion.div id={panelId} className={styles.accordion} initial={still ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={fade}>
                          <Panel item={item} compact />
                        </motion.div>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {meta || end ? (
                  <div className={styles.sheetFooter}>
                    {meta ? <span className={styles.meta}>{meta}</span> : <span />}
                    {end ? <span className={styles.sheetEnd}>{end}</span> : null}
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </nav>
      </div>
    )
  }

  return (
    <div ref={root} className={cx(styles.root, className)} onPointerLeave={leave} onPointerEnter={() => clearTimeout(timer.current)} onKeyDown={onKeyDown} onBlur={onBlur}>
      <nav ref={bar} aria-label={label} className={styles.bar}>
        {brand ? <span className={styles.brand}>{brand}</span> : null}
        <ul className={styles.tray}>
          {items.map((item) => (
            <li key={item.label} data-entry={item.label} onPointerEnter={(e) => enter(e, item)} onPointerDown={(e) => { pointer.current = e.pointerType }}>
              {item.links ? (
                <NavItem kind="trigger" label={item.label} chevron open={open === item.label} controls={open === item.label ? panelId : undefined} animated={animated} onClick={(e) => choose(e.detail > 0 && pointer.current === 'mouse' && !compact ? item.label : open === item.label ? null : item.label)} />
              ) : <NavItem kind="trigger" label={item.label} href={item.href} animated={animated} />}
            </li>
          ))}
        </ul>
        {end || search ? <span className={styles.end}>{search}{end}</span> : null}
        <AnimatePresence>
          {current && !compact ? (
            <motion.div
              ref={viewport}
              id={panelId}
              className={styles.viewport}
              style={{ x, width: current.width ?? DEFAULT_WIDTH }}
              initial={still ? { opacity: 1 } : { opacity: 0, scale: 0.98, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: duration.close } }}
              transition={{ duration: still ? 0 : PANEL_S, ease: ease.out }}
            >
              {/* The custom properties let the CSS counter the scale on the corners, so they stay round. */}
              <motion.span aria-hidden className={styles.surface} style={{ scaleX, scaleY, '--sx': scaleX, '--sy': scaleY } as MotionStyle} />
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div key={current.label} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }} transition={{ duration: still ? 0 : PANEL_S, ease: ease.out }}>
                  <Panel item={current} />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </nav>
    </div>
  )
}
