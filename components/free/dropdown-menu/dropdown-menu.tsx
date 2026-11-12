'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode, type Ref, type RefObject } from 'react'
import { ChevronLeftIcon } from '@fetaui/react/rounded/chevron-left'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { duration, ease, spring } from '../../motion-tokens'
import { useLabelMotion } from '../button/label-motion'
import { Button } from '../button/button'
import { Kbd } from '../kbd/kbd'
import { useDismiss } from '../form-kit/use-dismiss'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './dropdown-menu.module.css'

const SUBMENU_DELAY_MS = 100
const TYPE_RESET_MS = 600
const FLASH_MS = 100
const SUBMENU_X = 8
const DRILL_X = 24
const EDGE_GAP = 8
const COMPACT_WIDTH = 358
const SIDE_WIDTH = 248

/**
 * Returns `#` for an empty href or one with a script or data scheme, else the href unchanged.
 * Browsers ignore ASCII whitespace and control characters inside a scheme, so those are stripped before matching.
 * React 19 blocks `javascript:` links too; this also covers `vbscript:` and `data:`, and React 18 copies of the registry source.
 */
export function safeHref(href?: string): string {
  // eslint-disable-next-line no-control-regex
  const bare = (href ?? '').replace(/[\u0000-\u0020\u007f]/g, '')
  return !bare || /^(javascript|vbscript|data):/i.test(bare) ? '#' : href ?? '#'
}

type Shared = { id?: string; label: string; disabled?: boolean }
/** A row that runs something, or opens a submenu when it has `items`. */
export type MenuAction = Shared & {
  kind?: 'action'
  icon?: ReactNode
  shortcut?: string[]
  destructive?: boolean
  /** Gets the row's click, so a row with `href` can call `preventDefault()` and route on the client. Enter and Space click the row too. */
  onSelect?: (event: MouseEvent<HTMLElement>) => void
  items?: MenuEntry[]
  /** Trailing chevron for a row that opens something else. */
  chevron?: boolean
  /** A second, quieter line under the label. */
  description?: string
  /** An icon at the end of the row, such as an arrow for a link that leaves the page. */
  trailingIcon?: ReactNode
  /** Renders the row as a real link, so it opens in a new tab and can be copied. */
  href?: string
  /** With `href`. A `_blank` target always gets `noopener noreferrer`, added to any `rel` given. */
  target?: string
  rel?: string
}
export type MenuCheckbox = Shared & { kind: 'checkbox'; checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (checked: boolean) => void }
export type MenuRadioGroup = { kind: 'radio'; id?: string; label: string; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; options: { value: string; label: string; disabled?: boolean }[] }
export type MenuLabel = { kind: 'label'; label: string }
export type MenuSeparator = { kind: 'separator' }
/** Anything else, such as an account header. Not a row, so keys skip it. */
export type MenuCustom = { kind: 'custom'; content: ReactNode }
export type MenuEntry = MenuAction | MenuCheckbox | MenuRadioGroup | MenuLabel | MenuSeparator | MenuCustom

/** Toggles outlive the panel, so their values are held above it. */
export type MenuStore = { checks: Record<string, boolean>; radios: Record<string, string>; setCheck: (key: string, value: boolean) => void; setRadio: (key: string, value: string) => void }

export function useMenuStore(): MenuStore {
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [radios, setRadios] = useState<Record<string, string>>({})
  const setCheck = useCallback((key: string, value: boolean) => setChecks((held) => ({ ...held, [key]: value })), [])
  const setRadio = useCallback((key: string, value: string) => setRadios((held) => ({ ...held, [key]: value })), [])
  return { checks, radios, setCheck, setRadio }
}

let lastPoint: { x: number; y: number } | null = null
let pointMoved = false
let watching = false

/**
 * Browsers fire synthetic pointer events at a resting pointer after layout changes, and `movementX`
 * is 0 on WebKit's first move into an element, so real movement is told apart by coordinates.
 */
export function usePointerWatch(): void {
  useEffect(() => {
    if (watching) return
    watching = true
    window.addEventListener('pointermove', (e) => {
      pointMoved = lastPoint !== null && (lastPoint.x !== e.clientX || lastPoint.y !== e.clientY)
      lastPoint = { x: e.clientX, y: e.clientY }
    }, { capture: true, passive: true })
  }, [])
}

/** True while handling a pointermove that really moved. */
export const pointerMoved = (): boolean => pointMoved

/** Mobile by the preview's `data-platform`, or else by the viewport, like the tokens. */
export function isCompact(element: Element | null): boolean {
  const platform = element?.closest('[data-platform]')?.getAttribute('data-platform')
  if (platform) return platform === 'mobile'
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
}

/** The edges a floating panel may reach: the screen, or the platform frame it sits in. */
function boundary(node: Element): { left: number; right: number } {
  const frame = node.closest('[data-platform]')?.getBoundingClientRect()
  return { left: Math.max(frame?.left ?? 0, 0) + EDGE_GAP, right: Math.min(frame?.right ?? window.innerWidth, window.innerWidth) - EDGE_GAP }
}

/** Keeps a panel on screen under `anchor`, and full width on Mobile. Writes layout directly, before paint. */
export function fitPanel(node: HTMLElement, anchor: DOMRect, align: 'start' | 'end' = 'start', compactWidth = COMPACT_WIDTH): void {
  const parent = node.offsetParent?.getBoundingClientRect()
  if (!parent) return
  const { left, right } = boundary(node)
  if (isCompact(node)) node.style.width = `${Math.min(compactWidth, right - left)}px`
  const width = node.offsetWidth
  const wanted = align === 'end' ? anchor.right - width : anchor.left
  node.style.left = `${Math.max(left, Math.min(wanted, right - width)) - parent.left}px`
}

export function useFit(ref: RefObject<HTMLElement | null>, open: boolean, align: 'start' | 'end' = 'start'): void {
  useLayoutEffect(() => {
    const node = ref.current
    const anchor = node?.parentElement?.getBoundingClientRect()
    if (open && node && anchor) fitPanel(node, anchor, align)
  }, [ref, open, align])
}

const KEY_NAMES: Record<string, string> = { '⌘': 'Meta', '⇧': 'Shift', '⌥': 'Alt', '⌃': 'Control', '↵': 'Enter' }
/** `['⌘', 'E']` as `aria-keyshortcuts` wants it. */
export const keyShortcut = (keys: string[]): string => keys.flatMap((key) => [...key]).map((key) => KEY_NAMES[key] ?? key).join('+')

/** Keycaps at the end of a row. Decorative: the row carries `aria-keyshortcuts`. */
export const Keycaps = ({ keys, size = 'md', className }: { keys: string[]; size?: 'sm' | 'md'; className?: string | undefined }) => (
  <span className={cx(styles.keys, className)} aria-hidden="true">{keys.map((key) => <Kbd key={key} size={size}>{key}</Kbd>)}</span>
)

/** The header of an Account menu: avatar, name and email. */
export const MenuAccount = ({ avatar, name, email }: { avatar: ReactNode; name: string; email: string }) => (
  <div className={styles.accountHeader}>
    {avatar}
    <span className={styles.accountText}><strong>{name}</strong><span>{email}</span></span>
  </div>
)

type RowProps = {
  menuId: string
  rowKey: string
  label: string
  role: 'menuitem' | 'menuitemcheckbox' | 'menuitemradio'
  active: boolean
  still: boolean
  icon?: ReactNode | undefined
  lead?: ReactNode | undefined
  shortcut?: string[] | undefined
  trail?: ReactNode | undefined
  checked?: boolean | undefined
  disabled?: boolean | undefined
  destructive?: boolean | undefined
  flash?: boolean | undefined
  expanded?: boolean | undefined
  description?: string | undefined
  href?: string | undefined
  target?: string | undefined
  rel?: string | undefined
  onHover: () => void
  onActivate: (event: MouseEvent<HTMLElement>) => void
  onFocused: () => void
}

/** One row. Hovering focuses it, so pointer and keys share one highlight. */
function Row({ menuId, rowKey, label, role, active, still, icon, lead, shortcut, trail, checked, disabled, destructive, flash, expanded, description, href, target, rel, onHover, onActivate, onFocused }: RowProps) {
  const text = useLabelMotion(label, !still && !disabled && !destructive)
  const shared = {
    role,
    tabIndex: -1,
    className: styles.row,
    'data-menu-row': '',
    'data-key': rowKey,
    'data-label': label,
    'data-active': active ? '' : undefined,
    'data-destructive': destructive ? '' : undefined,
    'data-flash': flash ? '' : undefined,
    'data-still': still ? '' : undefined,
    'aria-disabled': disabled || undefined,
    'aria-checked': checked,
    'aria-haspopup': expanded === undefined ? undefined : ('menu' as const),
    'aria-expanded': expanded,
    'aria-keyshortcuts': shortcut ? keyShortcut(shortcut) : undefined,
    onFocus: onFocused,
    onPointerEnter: text.handlers.onPointerEnter,
    onPointerMove: (e: PointerEvent<HTMLElement>) => { if (!active && pointerMoved()) { e.currentTarget.focus({ preventScroll: true }); onHover() } },
    onPointerLeave: text.handlers.onPointerLeave,
    onPointerDown: text.handlers.onPointerDown,
  }
  const body = (
    <>
      {active ? <motion.span {...(still ? {} : { layoutId: `${menuId}-glide` })} className={styles.glide} transition={{ duration: still ? 0 : duration.press, ease: ease.out }} /> : null}
      {lead ?? (icon ? <span className={styles.icon}>{icon}</span> : null)}
      {description ? (
        <span className={styles.text}>
          <span className={styles.label}>{text.label}</span>
          <span className={styles.description}>{description}</span>
        </span>
      ) : <span className={styles.label}>{text.label}</span>}
      {shortcut ? <Keycaps keys={shortcut} /> : null}
      {trail}
    </>
  )
  if (href) {
    const safeRel = target === '_blank' ? [...new Set([...(rel ?? '').split(/\s+/).filter(Boolean), 'noopener', 'noreferrer'])].join(' ') : rel
    const link = disabled ? {} : { href: safeHref(href), target, rel: safeRel }
    return <a {...shared} {...link} onClick={(e) => { if (disabled) e.preventDefault(); else onActivate(e) }}>{body}</a>
  }
  return <button type="button" {...shared} onClick={(e) => { if (!disabled) onActivate(e) }}>{body}</button>
}

export type MenuProps = {
  entries: MenuEntry[]
  /** The menu's accessible name. */
  label: string
  store: MenuStore
  still: boolean
  /** `first` for keys, `last` for Arrow Up, `menu` for a click: no row lights up until one is reached. */
  focusOn?: 'first' | 'last' | 'menu' | 'none'
  /** Menubar skips disabled rows. Dropdown Menu keeps them focusable. */
  skipDisabled?: boolean
  /** Fires with how the menu ended. `select` also leaves time for the row to flash. */
  onClose?: (how: 'select' | 'escape' | 'tab') => void
  /** Left and Right at the top level of a Menubar menu. */
  onSide?: (step: 1 | -1) => void
  /** Leaves a side submenu. */
  onBack?: () => void
  className?: string
  id?: string
  ref?: Ref<HTMLDivElement>
}

/** The panel: rows, gliding highlight, type ahead and submenus. Dropdown Menu and Menubar both float it. */
export function Menu({ entries, label, store, still, focusOn = 'none', skipDisabled = false, onClose, onSide, onBack, className, id, ref }: MenuProps) {
  usePointerWatch()
  const uid = useId()
  const own = useRef<HTMLDivElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Its own timer, so hovering another row can never cancel the close.
  const closing = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [active, setActive] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [side, setSide] = useState<{ key: string; focus: boolean; flip: boolean } | null>(null)
  const [drill, setDrill] = useState<{ label: string; entries: MenuEntry[] }[]>([])
  const [drillFrom, setDrillFrom] = useState(1)
  const level = drill.at(-1)
  const shown = level?.entries ?? entries

  const rows = useCallback((): HTMLElement[] => {
    const menu = own.current
    if (!menu) return []
    return [...menu.querySelectorAll<HTMLElement>('[data-menu-row]')]
      .filter((row) => row.closest('[role="menu"]') === menu && !(skipDisabled && row.getAttribute('aria-disabled') === 'true'))
  }, [skipDisabled])

  useEffect(() => {
    if (focusOn === 'none') return
    if (focusOn === 'menu') own.current?.focus({ preventScroll: true })
    else (focusOn === 'last' ? rows().at(-1) : rows()[0])?.focus({ preventScroll: true })
  }, [focusOn, rows])

  useEffect(() => { if (drill.length) rows()[0]?.focus({ preventScroll: true }) }, [drill.length, rows])
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(closing.current) }, [])

  function focusRow(key: string): void {
    rows().find((row) => row.dataset.key === key)?.focus({ preventScroll: true })
  }

  function openSide(key: string, focus: boolean): void {
    clearTimeout(timer.current)
    const row = rows().find((item) => item.dataset.key === key)
    const right = row?.getBoundingClientRect().right ?? 0
    setSide({ key, focus, flip: row ? right + SIDE_WIDTH > boundary(row).right : false })
  }

  function hover(key: string, opens: boolean): void {
    clearTimeout(timer.current)
    if (side?.key === key) return
    timer.current = setTimeout(() => { if (opens) openSide(key, false); else setSide(null) }, SUBMENU_DELAY_MS)
  }

  function finish(key: string, run?: () => void): void {
    run?.()
    if (still) { onClose?.('select'); return }
    setFlash(key)
    closing.current = setTimeout(() => onClose?.('select'), FLASH_MS)
  }

  function openSub(key: string, entry: MenuAction, focus: boolean): void {
    if (isCompact(own.current)) {
      setDrillFrom(1)
      setDrill((path) => [...path, { label: entry.label, entries: entry.items ?? [] }])
      return
    }
    openSide(key, focus)
  }

  function back(): void {
    setDrillFrom(-1)
    setDrill((path) => path.slice(0, -1))
  }

  function typeahead(char: string): void {
    const now = Date.now()
    const text = now - typed.current.at > TYPE_RESET_MS ? char : typed.current.text + char
    typed.current = { text, at: now }
    rows().find((row) => row.dataset.label?.toLowerCase().startsWith(text.toLowerCase()))?.focus({ preventScroll: true })
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    // Submenus sit inside their parent row's wrapper, and each menu answers for itself.
    e.stopPropagation()
    const list = rows()
    const at = list.indexOf(document.activeElement as HTMLElement)
    const current = list[at]
    const move = (next: HTMLElement | undefined): void => { e.preventDefault(); next?.focus({ preventScroll: true }) }
    switch (e.key) {
      case 'ArrowDown': move(list[(at + 1) % list.length]); return
      case 'ArrowUp': move(list[at <= 0 ? list.length - 1 : at - 1]); return
      case 'Home': move(list[0]); return
      case 'End': move(list.at(-1)); return
      case 'Enter':
      case ' ': e.preventDefault(); current?.click(); return
      case 'Escape':
        e.preventDefault()
        if (onBack) onBack(); else onClose?.('escape')
        return
      case 'Tab': onClose?.('tab'); return
      case 'ArrowRight':
        e.preventDefault()
        if (current?.getAttribute('aria-haspopup') === 'menu') current.click()
        else onSide?.(1)
        return
      case 'ArrowLeft':
        e.preventDefault()
        if (drill.length) back()
        else if (onBack) onBack()
        else onSide?.(-1)
        return
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) typeahead(e.key)
    }
  }

  const render = (entry: MenuEntry, index: number): ReactNode => {
    if (entry.kind === 'separator') return <div key={index} role="separator" className={styles.separator} />
    if (entry.kind === 'label') return <div key={index} className={styles.groupLabel}>{entry.label}</div>
    if (entry.kind === 'custom') return <div key={index} className={styles.custom}>{entry.content}</div>
    const key = entry.id ?? entry.label
    const common = { menuId: uid, still, active: active === key, onFocused: () => setActive(key) }

    if (entry.kind === 'radio') {
      const value = entry.value ?? store.radios[key] ?? entry.defaultValue
      return (
        <div key={key} role="group" aria-label={entry.label}>
          <div className={styles.groupLabel}>{entry.label}</div>
          {entry.options.map((option) => {
            const on = option.value === value
            const rowKey = `${key}-${option.value}`
            return (
              <Row
                key={option.value}
                {...common}
                active={active === rowKey}
                onFocused={() => setActive(rowKey)}
                rowKey={rowKey}
                role="menuitemradio"
                label={option.label}
                checked={on}
                disabled={option.disabled}
                lead={<span className={styles.indicator}>{on ? <motion.span className={styles.dot} initial={still ? false : { scale: 0 }} animate={{ scale: 1 }} transition={still ? { duration: 0 } : spring.pop} /> : null}</span>}
                onHover={() => hover(rowKey, false)}
                onActivate={() => { store.setRadio(key, option.value); entry.onValueChange?.(option.value) }}
              />
            )
          })}
        </div>
      )
    }

    if (entry.kind === 'checkbox') {
      const on = entry.checked ?? store.checks[key] ?? entry.defaultChecked ?? false
      return (
        <Row
          key={key}
          {...common}
          rowKey={key}
          role="menuitemcheckbox"
          label={entry.label}
          checked={on}
          disabled={entry.disabled}
          lead={<span className={styles.indicator}>{on ? <Tick02Icon trigger="inView" speed={2} /> : null}</span>}
          onHover={() => hover(key, false)}
          onActivate={() => { store.setCheck(key, !on); entry.onCheckedChange?.(!on) }}
        />
      )
    }

    const { items } = entry
    const row = (
      <Row
        key={key}
        {...common}
        rowKey={key}
        role="menuitem"
        label={entry.label}
        icon={entry.icon}
        shortcut={entry.shortcut}
        disabled={entry.disabled}
        destructive={entry.destructive}
        flash={flash === key}
        description={entry.description}
        {...(items ? {} : { href: entry.href, target: entry.target, rel: entry.rel })}
        {...(items ? { expanded: side?.key === key } : {})}
        {...(items || entry.chevron ? { trail: <span className={styles.chevron}><ChevronRightIcon /></span> } : entry.trailingIcon ? { trail: <span className={styles.trailing}>{entry.trailingIcon}</span> } : {})}
        onHover={() => hover(key, Boolean(items) && !isCompact(own.current))}
        onActivate={(e) => (items ? openSub(key, entry, true) : finish(key, () => entry.onSelect?.(e)))}
      />
    )
    if (!items) return row
    return (
      <div key={key} className={styles.subWrap}>
        {row}
        <AnimatePresence>
          {side?.key === key ? (
            <motion.div
              className={styles.side}
              data-flip={side.flip ? '' : undefined}
              initial={still ? { opacity: 1 } : { opacity: 0, x: side.flip ? -SUBMENU_X : SUBMENU_X }}
              animate={{ opacity: 1, x: 0 }}
              exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: duration.press } }}
              transition={{ duration: still ? 0 : duration.open, ease: ease.out }}
              onPointerEnter={() => clearTimeout(timer.current)}
            >
              <Menu
                entries={items}
                label={entry.label}
                store={store}
                still={still}
                skipDisabled={skipDisabled}
                focusOn={side.focus ? 'first' : 'none'}
                {...(onClose ? { onClose } : {})}
                onBack={() => { setSide(null); focusRow(key) }}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div
      ref={(node) => {
        own.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      id={id}
      role="menu"
      aria-label={level?.label ?? label}
      tabIndex={-1}
      className={cx(styles.menu, className)}
      data-still={still ? '' : undefined}
      onKeyDown={onKeyDown}
    >
      {level ? (
        <Row
          menuId={uid}
          rowKey="back"
          role="menuitem"
          label={level.label}
          still={still}
          active={active === 'back'}
          lead={<span className={styles.icon}><ChevronLeftIcon /></span>}
          onFocused={() => setActive('back')}
          onHover={() => undefined}
          onActivate={back}
        />
      ) : null}
      {level ? <div role="separator" className={styles.separator} /> : null}
      <motion.div key={drill.length} initial={still || !drill.length && drillFrom === 1 ? false : { opacity: 0, x: drillFrom * DRILL_X }} animate={{ opacity: 1, x: 0 }} transition={{ duration: still ? 0 : duration.open, ease: ease.out }}>
        {shown.map(render)}
      </motion.div>
    </div>
  )
}

type Focus = NonNullable<MenuProps['focusOn']>

/** What a custom trigger must spread. */
export type MenuTriggerProps = {
  ref: Ref<HTMLButtonElement>
  id: string
  'aria-haspopup': 'menu'
  'aria-expanded': boolean
  'aria-controls': string | undefined
  'data-open': '' | undefined
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
}

export type DropdownMenuProps = {
  entries: MenuEntry[]
  /** Text on the default trigger, and the menu's name. */
  label: string
  /** Replaces the default trigger: spread the props on any button. */
  trigger?: (props: MenuTriggerProps) => ReactNode
  /** Leading icon on the default trigger. */
  icon?: ReactNode
  /** Turns the default trigger into the Account pill. */
  avatar?: ReactNode
  /** Which edge of the trigger the menu lines up with. */
  align?: 'start' | 'end'
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  animated?: boolean
  className?: string
}

/** A list of actions behind a button. It grows from the trigger and the highlight glides between rows. */
export function DropdownMenu({ entries, label, trigger, icon, avatar, align = 'start', open, defaultOpen = false, onOpenChange, animated = true, className }: DropdownMenuProps) {
  const still = useStill(animated)
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const store = useMenuStore()
  const [held, setHeld] = useState(defaultOpen)
  const [focusOn, setFocusOn] = useState<Focus>('none')
  const shown = open ?? held
  const menuId = `${uid}-menu`

  const set = useCallback((next: boolean): void => { setHeld(next); onOpenChange?.(next) }, [onOpenChange])
  const dismiss = useCallback(() => set(false), [set])
  useDismiss(root, shown, dismiss)
  useFit(pop, shown, align)

  function show(from: Focus): void {
    setFocusOn(from)
    set(true)
  }

  const props: MenuTriggerProps = {
    ref: button,
    id: `${uid}-trigger`,
    'aria-haspopup': 'menu',
    'aria-expanded': shown,
    'aria-controls': shown ? menuId : undefined,
    'data-open': shown ? '' : undefined,
    onClick: (e) => {
      // Safari does not focus a button on click, and focus has to come back here.
      e.currentTarget.focus()
      if (shown) set(false)
      else show('menu')
    },
    onKeyDown: (e) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!shown) show('first') }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (!shown) show('last') }
    },
  }

  return (
    <div ref={root} className={cx(styles.root, className)}>
      {trigger ? trigger(props) : avatar ? (
        <button {...props} type="button" className={styles.account} data-still={still ? '' : undefined}>
          {avatar}
          <span>{label}</span>
          <motion.span className={styles.turn} initial={false} animate={{ rotate: shown ? 0 : 180 }} transition={{ duration: still ? 0 : duration.lift, ease: ease.out }}><ChevronUpIcon /></motion.span>
        </button>
      ) : (
        <Button
          {...props}
          variant="secondary"
          size="sm"
          className={styles.trigger}
          animated={animated}
          leadingIcon={icon}
          trailingIcon={<motion.span className={styles.turn} initial={false} animate={{ rotate: shown ? 0 : 180 }} transition={{ duration: still ? 0 : duration.lift, ease: ease.out }}><ChevronUpIcon /></motion.span>}
        >
          {label}
        </Button>
      )}
      <AnimatePresence>
        {shown ? (
          <motion.div
            ref={pop}
            className={styles.pop}
            data-align={align}
            initial={still ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: duration.press } }}
            transition={{ duration: still ? 0 : duration.lift, ease: ease.out }}
          >
            <Menu
              id={menuId}
              entries={entries}
              label={label}
              store={store}
              still={still}
              focusOn={focusOn}
              onClose={(how) => {
                set(false)
                if (how !== 'tab') button.current?.focus({ preventScroll: true })
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
