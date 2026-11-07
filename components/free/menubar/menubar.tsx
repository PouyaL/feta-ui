'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { duration, ease, spring } from '../../motion-tokens'
import { useLabelMotion } from '../button/label-motion'
import { Keycaps, Menu, fitPanel, pointerMoved, useMenuStore, usePointerWatch, type MenuEntry, type MenuProps } from '../dropdown-menu/dropdown-menu'
import { useDismiss } from '../form-kit/use-dismiss'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './menubar.module.css'

export type MenubarMenu = {
  label: string
  entries: MenuEntry[]
  /** The access key, shown while Alt is held. Defaults to the first letter. */
  mnemonic?: string
  disabled?: boolean
}

export type MenubarProps = {
  menus: MenubarMenu[]
  /** The bar's accessible name. */
  label: string
  /** Opens this menu on mount. */
  defaultOpen?: string
  animated?: boolean
  className?: string
}

const mnemonicOf = (menu: MenubarMenu): string => (menu.mnemonic ?? menu.label.charAt(0)).toUpperCase()
type Focus = NonNullable<MenuProps['focusOn']>

type TriggerProps = {
  menu: MenubarMenu
  index: number
  open: boolean
  stop: boolean
  hints: boolean
  still: boolean
  uid: string
  onPress: () => void
  onEnter: () => void
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
}

function Trigger({ menu, index, open, stop, hints, still, uid, onPress, onEnter, onKeyDown }: TriggerProps) {
  const text = useLabelMotion(menu.label, !still && !menu.disabled)
  return (
    <button
      type="button"
      role="menuitem"
      id={`${uid}-trigger-${index}`}
      className={styles.trigger}
      data-index={index}
      aria-haspopup="menu"
      aria-expanded={open}
      aria-disabled={menu.disabled || undefined}
      aria-keyshortcuts={`Alt+${mnemonicOf(menu)}`}
      data-open={open ? '' : undefined}
      tabIndex={stop ? 0 : -1}
      onClick={(e) => { e.currentTarget.focus(); if (!menu.disabled) onPress() }}
      onPointerEnter={text.handlers.onPointerEnter}
      onPointerMove={() => { if (pointerMoved()) onEnter() }}
      onPointerLeave={text.handlers.onPointerLeave}
      onPointerDown={text.handlers.onPointerDown}
      onKeyDown={(e) => { onKeyDown(e); text.handlers.onKeyDown(e) }}
    >
      {open ? <motion.span {...(still ? {} : { layoutId: `${uid}-tab` })} className={styles.tab} style={{ borderRadius: 10 }} transition={spring.slide} /> : null}
      <span className={styles.label}>{text.label}</span>
      <AnimatePresence initial={false}>
        {hints ? (
          <motion.span className={styles.hint} initial={{ opacity: still ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: still ? 0 : duration.focus } }} transition={{ duration: still ? 0 : duration.focus, ease: ease.out }}>
            <Keycaps keys={[mnemonicOf(menu)]} size="sm" />
          </motion.span>
        ) : null}
      </AnimatePresence>
    </button>
  )
}

/** A persistent row of menus, like a desktop app. The open tab slides between triggers and menus swap at once, so scanning stays fast. */
export function Menubar({ menus, label, defaultOpen, animated = true, className }: MenubarProps) {
  usePointerWatch()
  const still = useStill(animated)
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const store = useMenuStore()
  const first = menus.findIndex((menu) => !menu.disabled)
  const initial = menus.findIndex((menu) => menu.label === defaultOpen)
  const [open, setOpen] = useState<number | null>(initial < 0 ? null : initial)
  const [stop, setStop] = useState(Math.max(0, initial < 0 ? first : initial))
  const [focusOn, setFocusOn] = useState<Focus>('none')
  const [hints, setHints] = useState(false)
  const close = useCallback(() => setOpen(null), [])
  useDismiss(root, open !== null, close)

  const triggerAt = useCallback((index: number) => root.current?.querySelector<HTMLElement>(`[data-index="${index}"]`) ?? null, [])

  useLayoutEffect(() => {
    const node = pop.current
    const trigger = open === null ? null : triggerAt(open)
    if (node && trigger) fitPanel(node, trigger.getBoundingClientRect())
  }, [open, triggerAt])

  function step(from: number, by: 1 | -1): number {
    for (let i = 1; i <= menus.length; i += 1) {
      const next = (from + by * i + menus.length * i) % menus.length
      if (!menus[next]?.disabled) return next
    }
    return from
  }

  function show(index: number, focus: Focus): void {
    setStop(index)
    setFocusOn(focus)
    setOpen(index)
  }

  // Alt shows the access keys, and a letter opens its menu. `code`, because Alt changes the character on a Mac.
  useEffect(() => {
    const down = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Alt') { setHints(true); return }
      if (!e.altKey || e.ctrlKey || e.metaKey || !e.code.startsWith('Key')) return
      // Option types characters on a Mac, so a text field keeps the key.
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return
      const index = menus.findIndex((menu) => !menu.disabled && mnemonicOf(menu) === e.code.slice(3))
      if (index < 0) return
      e.preventDefault()
      triggerAt(index)?.focus({ preventScroll: true })
      show(index, 'first')
    }
    const up = (e: globalThis.KeyboardEvent): void => { if (e.key === 'Alt') setHints(false) }
    const leave = (): void => setHints(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', leave)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', leave)
    }
  }, [menus, triggerAt])

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    const at = Number(e.currentTarget.dataset.index)
    const move = (next: number): void => {
      e.preventDefault()
      setStop(next)
      triggerAt(next)?.focus()
      if (open !== null) show(next, 'none')
    }
    switch (e.key) {
      case 'ArrowRight': move(step(at, 1)); break
      case 'ArrowLeft': move(step(at, -1)); break
      case 'Home': move(step(-1 + menus.length, 1)); break
      case 'End': move(step(0, -1)); break
      case 'ArrowDown':
      case 'Enter':
      case ' ': e.preventDefault(); if (!menus[at]?.disabled) show(at, 'first'); break
      case 'ArrowUp': e.preventDefault(); if (!menus[at]?.disabled) show(at, 'last'); break
      case 'Escape': close(); break
      default:
    }
  }

  const current = open === null ? undefined : menus[open]

  return (
    <div ref={root} className={cx(styles.root, className)} data-still={still ? '' : undefined}>
      <div role="menubar" aria-label={label} className={styles.bar}>
        {menus.map((menu, index) => (
          <Trigger
            key={menu.label}
            menu={menu}
            index={index}
            open={open === index}
            stop={stop === index}
            hints={hints}
            still={still}
            uid={uid}
            onPress={() => { if (open === index) close(); else show(index, 'menu') }}
            onEnter={() => { if (open !== null && open !== index && !menu.disabled) show(index, 'menu') }}
            onKeyDown={onKeyDown}
          />
        ))}
      </div>
      <AnimatePresence>
        {current && open !== null ? (
          <motion.div
            ref={pop}
            className={styles.pop}
            initial={still ? { opacity: 1 } : { opacity: 0, scale: 0.98, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: duration.focus } }}
            transition={{ duration: still ? 0 : duration.lift, ease: ease.out }}
          >
            {/* Keyed by menu, so content swaps with no fade while the panel stays put. */}
            <Menu
              key={current.label}
              entries={current.entries}
              label={current.label}
              store={store}
              still={still}
              skipDisabled
              focusOn={focusOn}
              onSide={(by) => { const next = step(open, by); triggerAt(next)?.focus({ preventScroll: true }); show(next, 'first') }}
              onClose={(how) => {
                const at = open
                close()
                if (how !== 'tab') triggerAt(at)?.focus({ preventScroll: true })
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
