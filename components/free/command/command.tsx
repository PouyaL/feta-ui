'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { LoaderIcon } from '@fetaui/react/rounded/loader'
import { SearchIcon } from '@fetaui/react/rounded/search'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { duration, ease, spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { Modal, type ModalMotion } from '../dialog/modal'
import { Keycaps, keyShortcut, pointerMoved, usePointerWatch } from '../dropdown-menu/dropdown-menu'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './command.module.css'

const SUBMENU_X = 16
/** A pressed key hint holds this long, so a tap can be seen. */
const KEY_FLASH_MS = 120
const POSE: ModalMotion = { from: { opacity: 0, scale: 0.96 }, exit: { opacity: 0, scale: 0.98 }, open: { duration: duration.open, ease: ease.out }, close: { duration: duration.close } }

export type CommandItem = {
  id: string
  title: string
  description?: string
  icon?: ReactNode
  shortcut?: string[]
  disabled?: boolean
  /** May return a promise: the row keeps a spinner until it settles. A rejection keeps the palette open. */
  onRun?: () => void | Promise<void>
  /** Opens a submenu in place. */
  items?: CommandItem[]
  /** Holds the command behind an inline danger confirm. */
  confirm?: { title: string; body: string; action: string }
}
export type CommandGroup = { label: string; items: CommandItem[] }

export type CommandProps = {
  groups: CommandGroup[]
  placeholder?: string
  /** Starts with this query. */
  defaultQuery?: string
  /** Offered when nothing matches, with the query. */
  onAsk?: (query: string) => void
  /** Fires after a command runs and on Esc or Cancel. A failed command does not close it. */
  onClose?: () => void
  /** Shows the hint for the shortcut that opens the palette. */
  shortcut?: string
  animated?: boolean
  className?: string
}

/** Every letter in order, so `shr` finds Share. */
export function fuzzy(query: string, text: string): boolean {
  let at = 0
  const haystack = text.toLowerCase()
  for (const char of query.toLowerCase().replace(/\s+/g, '')) {
    at = haystack.indexOf(char, at)
    if (at < 0) return false
    at += 1
  }
  return true
}

const countItems = (groups: CommandGroup[]): number => groups.reduce((sum, group) => sum + group.items.length, 0)

/** A keyboard first menu for every action in the product. */
export function Command({ groups, placeholder = 'Search commands', defaultQuery = '', onAsk, onClose, shortcut = '⌘ K', animated = true, className }: CommandProps) {
  usePointerWatch()
  const still = useStill(animated)
  const uid = useId()
  const input = useRef<HTMLInputElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const [query, setQuery] = useState(defaultQuery)
  const [path, setPath] = useState<CommandItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [pressed, setPressed] = useState<string | null>(null)
  const level = path.at(-1)
  const autoFocus = Boolean(onClose)

  const base = useMemo<CommandGroup[]>(() => (level ? [{ label: level.title, items: level.items ?? [] }] : groups), [level, groups])
  const shownGroups = useMemo(() => {
    const q = query.trim()
    if (!q) return base
    return base.map((group) => ({ ...group, items: group.items.filter((item) => fuzzy(q, `${item.title} ${item.description ?? ''}`)) })).filter((group) => group.items.length)
  }, [base, query])
  const flat = useMemo(() => shownGroups.flatMap((group) => group.items), [shownGroups])
  const enabled = useMemo(() => flat.filter((item) => !item.disabled), [flat])
  const askable = Boolean(onAsk && query.trim() && !flat.length)
  const active = enabled.some((item) => item.id === activeId) ? activeId : enabled[0]?.id ?? null
  const optionId = (id: string): string => `${uid}-${id}`
  const listId = `${uid}-list`

  // A palette opens to type in, so it takes focus at once.
  useEffect(() => { if (autoFocus) input.current?.focus() }, [autoFocus])
  useEffect(() => { if (confirming) cancel.current?.focus() }, [confirming])
  useEffect(() => {
    // Only the list scrolls, so a Command placed in a page never moves the page.
    const option = active ? document.getElementById(optionId(active)) : null
    const list = document.getElementById(listId)
    if (!option || !list) return
    const box = option.getBoundingClientRect()
    const view = list.getBoundingClientRect()
    if (box.top < view.top) list.scrollTop -= view.top - box.top
    else if (box.bottom > view.bottom) list.scrollTop += box.bottom - view.bottom
    // optionId and listId only close over uid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const flashKey = useCallback((key: string) => {
    setPressed(key)
    setTimeout(() => setPressed(null), KEY_FLASH_MS)
  }, [])

  async function run(item: CommandItem): Promise<void> {
    if (item.disabled || running) return
    if (item.items) { setPath((held) => [...held, item]); setQuery(''); setActiveId(null); return }
    if (item.confirm && confirming !== item.id) { setConfirming(item.id); return }
    setFailed(null)
    try {
      const result = item.onRun?.()
      if (result) {
        setRunning(item.id)
        await result
      }
    } catch {
      setFailed(item.title)
      return
    } finally {
      setRunning(null)
    }
    setConfirming(null)
    onClose?.()
  }

  function unconfirm(): void {
    setConfirming(null)
    input.current?.focus()
  }

  function move(step: number): void {
    const at = enabled.findIndex((item) => item.id === active)
    const next = enabled[(at + step + enabled.length) % enabled.length]
    if (next) setActiveId(next.id)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') { e.preventDefault(); flashKey('↓'); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); flashKey('↑'); move(-1) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      // A confirm answers only on its own buttons.
      if (confirming) return
      flashKey('↵')
      if (askable) onAsk?.(query.trim())
      else {
        const item = enabled.find((entry) => entry.id === active)
        if (item) void run(item)
      }
    }
  }

  // On the root, because focus sits on Cancel during a confirm.
  function onRootKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape' && (confirming || onClose)) {
      e.preventDefault()
      e.stopPropagation()
      if (confirming) unconfirm()
      else onClose?.()
    } else if (e.key === 'Backspace' && !query && level && !confirming) {
      e.preventDefault()
      setPath((held) => held.slice(0, -1))
    }
  }

  // A press on a row or a disabled row must not take focus from the search field.
  function keepFocus(e: MouseEvent<HTMLDivElement>): void {
    if (!(e.target instanceof Element && e.target.closest('button'))) e.preventDefault()
  }

  const hint = (key: string): ReactNode => <span data-pressed={pressed === key ? '' : undefined} className={styles.hintKey}><Keycaps keys={[key]} /></span>
  const fade = { duration: still ? 0 : duration.focus, ease: ease.out }

  const row = (item: CommandItem): ReactNode => {
    const on = item.id === active
    const danger = confirming === item.id
    return (
      <div key={item.id} className={styles.rowWrap}>
        {danger && item.confirm ? (
          <motion.div
            className={styles.confirm}
            role="alertdialog"
            aria-label={item.confirm.title}
            initial={still ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={still ? { duration: 0 } : spring.pop}
          >
            {item.icon ? <span className={styles.confirmIcon}>{item.icon}</span> : null}
            <span className={styles.text} data-stacked="">
              <span className={styles.confirmTitle}>{item.confirm.title}</span>
              <span className={styles.confirmBody}>{item.confirm.body}</span>
              <span className={styles.confirmActions}>
                <Button ref={cancel} variant="ghost" size="sm" animated={animated} onClick={unconfirm}>Cancel</Button>
                <Button variant="destructive" size="sm" animated={animated} onClick={() => { void run(item) }}>{item.confirm.action}</Button>
              </span>
            </span>
          </motion.div>
        ) : (
          <div
            id={optionId(item.id)}
            role="option"
            aria-selected={on}
            aria-disabled={item.disabled || undefined}
            aria-keyshortcuts={item.shortcut ? keyShortcut(item.shortcut) : undefined}
            className={styles.row}
            data-active={on ? '' : undefined}
            onPointerMove={() => { if (!on && !item.disabled && pointerMoved()) setActiveId(item.id) }}
            onClick={() => { void run(item) }}
          >
            {on ? <motion.span {...(still ? {} : { layoutId: `${uid}-glide` })} className={styles.glide} transition={{ duration: still ? 0 : duration.press, ease: ease.out }} /> : null}
            {item.icon ? <span className={styles.icon}>{item.icon}</span> : null}
            <span className={styles.text}>
              <span className={styles.title}>{item.title}</span>
              {item.description ? <span className={styles.description}>{item.description}</span> : null}
            </span>
            {running === item.id ? <span className={styles.spin}><LoaderIcon trigger="none" /></span> : item.shortcut ? <Keycaps keys={item.shortcut} /> : null}
          </div>
        )}
      </div>
    )
  }

  const footer = failed ? `${failed} failed` : confirming ? 'Needs confirmation' : level ? level.title : query.trim() ? `${flat.length} of ${countItems(groups)}` : `${countItems(groups)} commands`

  return (
    <div className={cx(styles.command, className)} data-still={still ? '' : undefined} onKeyDown={onRootKey}>
      <div className={styles.search}>
        <span className={styles.searchIcon}><SearchIcon /></span>
        {level ? <motion.span className={styles.chip} initial={still ? false : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={still ? { duration: 0 } : spring.pop}>{level.title}</motion.span> : null}
        <input
          ref={input}
          className={styles.input}
          role="combobox"
          aria-expanded={true}
          aria-controls={listId}
          aria-activedescendant={active ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-label={placeholder}
          autoComplete="off"
          spellCheck={false}
          placeholder={level ? `Pick ${level.title.toLowerCase()}` : placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveId(null); setFailed(null) }}
          onKeyDown={onKeyDown}
        />
        <span className={styles.webOnly}><Keycaps keys={[level ? '⌫' : 'Esc']} /></span>
        <span className={styles.webOnly}><Keycaps keys={[shortcut]} /></span>
        {onClose ? <span className={styles.mobileOnly}><Button variant="ghost" size="sm" animated={animated} onClick={onClose}>Cancel</Button></span> : null}
      </div>
      <div className={styles.body}>
        <motion.div
          key={path.length}
          id={listId}
          role="listbox"
          aria-label="Commands"
          className={styles.list}
          onMouseDown={keepFocus}
          initial={still || !path.length ? false : { opacity: 0, x: -SUBMENU_X }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: still ? 0 : duration.base, ease: ease.out }}
        >
          {flat.length ? shownGroups.map((group, g) => (
            <div key={group.label} role="group" aria-labelledby={`${uid}-group-${g}`}>
              <div id={`${uid}-group-${g}`} className={styles.groupLabel}>{query.trim() ? `${group.items.length} result${group.items.length === 1 ? '' : 's'}` : group.label}</div>
              <AnimatePresence initial={false} mode="popLayout">
                {group.items.map((item) => (
                  <motion.div key={item.id} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }} transition={fade}>{row(item)}</motion.div>
                ))}
              </AnimatePresence>
            </div>
          )) : (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}><SearchIcon /></span>
              <strong>No commands for “{query.trim()}”</strong>
              <span>{onAsk ? 'Try a project action, or ask the assistant instead.' : 'Try a different word.'}</span>
              {onAsk ? (
                <button type="button" className={styles.ask} onClick={() => onAsk(query.trim())}>
                  <span className={styles.icon}><SparklesIcon /></span>
                  <span className={styles.text}><span className={styles.title}>Ask about “{query.trim()}”</span><span className={styles.description}>Get an answer from the assistant</span></span>
                  <Keycaps keys={['↵']} />
                </button>
              ) : null}
            </div>
          )}
        </motion.div>
      </div>
      <div className={styles.footer}>
        <span className={styles.webOnly}><span className={styles.hints}>{hint('↑')}{hint('↓')}<span>Navigate</span>{confirming ? <>{hint('Esc')}<span>Cancel</span></> : <>{hint('↵')}<span>Open</span></>}</span></span>
        <span className={styles.mobileOnly}>Tap a command to run it</span>
        <span className={styles.count} aria-live="polite">{footer}</span>
      </div>
    </div>
  )
}

export type CommandDialogProps = Omit<CommandProps, 'onClose'> & {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Listens for ⌘K and Ctrl K. Default true. */
  hotkey?: boolean
  label?: string
}

/** The palette in a modal: ⌘K opens it, the page goes inert and focus returns to where it was pressed. */
export function CommandDialog({ open, defaultOpen = false, onOpenChange, hotkey = true, label = 'Command menu', animated = true, ...rest }: CommandDialogProps) {
  const [held, setHeld] = useState(defaultOpen)
  const shown = open ?? held

  const set = useCallback((next: boolean): void => {
    setHeld(next)
    onOpenChange?.(next)
  }, [onOpenChange])

  useEffect(() => {
    if (!hotkey) return
    const down = (e: globalThis.KeyboardEvent): void => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); set(!shown) }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [hotkey, set, shown])

  return (
    <Modal open={shown} onDismiss={() => set(false)} label={label} pose={() => POSE} animated={animated} className={styles.dialog}>
      <Command {...rest} animated={animated} onClose={() => set(false)} />
    </Modal>
  )
}
