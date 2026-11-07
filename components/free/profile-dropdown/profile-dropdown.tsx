'use client'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { BellOffIcon } from '@fetaui/react/rounded/bell-off'
import { ChevronLeftIcon } from '@fetaui/react/rounded/chevron-left'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { CreditCardIcon } from '@fetaui/react/rounded/credit-card'
import { FlipHorizontalIcon } from '@fetaui/react/rounded/flip-horizontal'
import { MoonIcon } from '@fetaui/react/rounded/moon'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { ExchangeIcon } from '@fetaui/react/rounded/exchange'
import { SettingsIcon } from '@fetaui/react/rounded/settings'
import { SunIcon } from '@fetaui/react/rounded/sun'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { UserIcon } from '@fetaui/react/rounded/user'
import { duration, ease, spring } from '../../motion-tokens'
import { Avatar, type AvatarBadgeType } from '../avatar/avatar'
import { useLabelMotion } from '../button/label-motion'
import { IconButton } from '../icon-button/icon-button'
import { Menu, useFit, useMenuStore, type MenuEntry } from '../dropdown-menu/dropdown-menu'
import { useDismiss } from '../form-kit/use-dismiss'
import { cx, useStill } from '../motion-kit/motion-kit'
import { ToggleGroup } from '../toggle-group/toggle-group'
import styles from './profile-dropdown.module.css'

const HOLD_S = 1.2
const DRAIN_S = 0.3
const PANEL_S = 0.24
const PANEL_X = 24
const HAPTIC_MS = 12
const TYPE_RESET_MS = 600
/** The paused note grows in from just under full size. */
const NOTE_SCALE = 0.96

export type ProfileAccount = { id: string; name: string; email: string; initials: string }
export type ProfileStatus = 'online' | 'away' | 'dnd'
export type ProfileTheme = 'light' | 'dark' | 'system'

export type ProfileDropdownProps = {
  account: ProfileAccount
  /** Everyone else this person can switch to. */
  accounts?: ProfileAccount[]
  plan?: string
  status?: ProfileStatus
  defaultStatus?: ProfileStatus
  onStatusChange?: (status: ProfileStatus) => void
  theme?: ProfileTheme
  defaultTheme?: ProfileTheme
  onThemeChange?: (theme: ProfileTheme) => void
  /** The note under the status while it is `dnd`. */
  pausedNote?: string
  onSwitchAccount?: (account: ProfileAccount) => void
  onAddAccount?: () => void
  onProfile?: () => void
  onSettings?: () => void
  onBilling?: () => void
  /** Fires when the 1.2 s hold completes. */
  onSignOut?: () => void
  defaultOpen?: boolean
  animated?: boolean
  className?: string
}

const BADGE: Record<ProfileStatus, AvatarBadgeType> = { online: 'online', away: 'away', dnd: 'busy' }
const STATUS_NAME: Record<ProfileStatus, string> = { online: 'Online', away: 'Away', dnd: 'Do not disturb' }

/** Hold to confirm. The fill says how long is left, so it still moves with reduced motion. */
function HoldToSignOut({ onDone, still }: { onDone: () => void; still: boolean }) {
  const progress = useMotionValue(0)
  const clip = useTransform(progress, (value) => `inset(0 ${(1 - value) * 100}% 0 0)`)
  const run = useRef<ReturnType<typeof animate> | null>(null)
  const done = useRef(false)
  const [holding, setHolding] = useState(false)

  useEffect(() => () => run.current?.stop(), [])

  function start(): void {
    if (holding) return
    done.current = false
    setHolding(true)
    run.current?.stop()
    run.current = animate(progress, 1, {
      duration: HOLD_S * (1 - progress.get()),
      ease: 'linear',
      onComplete: () => {
        done.current = true
        navigator.vibrate?.(HAPTIC_MS)
        setHolding(false)
        onDone()
      },
    })
  }

  function release(): void {
    if (done.current) return
    setHolding(false)
    run.current?.stop()
    run.current = animate(progress, 0, { duration: still ? 0 : DRAIN_S, ease: ease.out })
  }

  const keys = (e: KeyboardEvent<HTMLButtonElement>): boolean => e.key === 'Enter' || e.key === ' '
  const hint = holding ? 'Keep holding' : 'Hold'

  return (
    <button
      type="button"
      className={styles.signOut}
      data-holding={holding ? '' : undefined}
      data-sign-out=""
      onPointerDown={start}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onKeyDown={(e) => { if (keys(e) && !e.repeat) { e.preventDefault(); start() } }}
      onKeyUp={(e) => { if (keys(e)) release() }}
      onBlur={release}
    >
      <span className={styles.signOutIcon}><ChevronRightIcon /></span>
      <span className={styles.signOutLabel}>Sign out</span>
      <span className={styles.hint} aria-live="polite">{hint}</span>
      {/* The solid fill repeats the row in white, so text turns as the edge passes it. */}
      <motion.span data-keep-motion="" className={styles.fill} style={{ clipPath: clip }} aria-hidden="true">
        <span className={styles.signOutIcon}><ChevronRightIcon /></span>
        <span className={styles.signOutLabel}>Sign out</span>
        <span className={styles.hint}>{hint}</span>
      </motion.span>
    </button>
  )
}

/** One account in Switch account. The label follows the pointer like a menu row. */
function AccountRow({ person, current, still, badge, avatar, onPick }: { person: ProfileAccount; current: boolean; still: boolean; badge: AvatarBadgeType | undefined; avatar: (who: ProfileAccount, badge?: AvatarBadgeType) => ReactNode; onPick: () => void }) {
  const name = useLabelMotion(person.name, !still)
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={current}
      tabIndex={current ? 0 : -1}
      className={styles.accountRow}
      data-account-row=""
      data-label={person.name}
      onPointerMove={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true }) }}
      {...name.handlers}
      onClick={onPick}
    >
      {avatar(person, badge)}
      <span className={styles.who}><strong>{name.label}</strong><span>{person.email}</span></span>
      {current ? <span className={styles.tick}><Tick02Icon /></span> : null}
    </button>
  )
}

/** The account menu behind your avatar, with status, theme and a hold to sign out. */
export function ProfileDropdown({ account, accounts = [], plan = 'Pro', status, defaultStatus = 'online', onStatusChange, theme, defaultTheme = 'system', onThemeChange, pausedNote = 'Notifications paused until 9:00 AM', onSwitchAccount, onAddAccount, onProfile, onSettings, onBilling, onSignOut, defaultOpen = false, animated = true, className }: ProfileDropdownProps) {
  const still = useStill(animated)
  // Reduced motion keeps a fade, as the Motion frame asks. `animated={false}` keeps nothing.
  const reduce = useReducedMotion()
  const fade = still && animated && Boolean(reduce)
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const back = useRef<HTMLButtonElement>(null)
  const accountsMenu = useRef<HTMLDivElement>(null)
  const switching = useRef(false)
  const typed = useRef({ text: '', at: 0 })
  const store = useMenuStore()
  const [open, setOpen] = useState(defaultOpen)
  const [panel, setPanel] = useState<'main' | 'switch'>('main')
  const [focusRows, setFocusRows] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [heldStatus, setHeldStatus] = useState(defaultStatus)
  const [heldTheme, setHeldTheme] = useState(defaultTheme)
  const currentStatus = status ?? heldStatus
  const currentTheme = theme ?? heldTheme
  const close = useCallback(() => { setOpen(false); setPanel('main') }, [])
  useDismiss(root, open, close)
  useFit(pop, open)

  useEffect(() => {
    if (panel === 'switch') back.current?.focus({ preventScroll: true })
    else if (switching.current) {
      // Back returns to the row that opened Switch account.
      switching.current = false
      pop.current?.querySelector<HTMLElement>('[data-menu-row][data-key="switch"]')?.focus({ preventScroll: true })
    }
  }, [panel])

  function leaveSwitch(): void {
    setFocusRows(false)
    setPanel('main')
  }

  function shut(): void {
    close()
    trigger.current?.focus({ preventScroll: true })
  }

  /**
   * Tab moves through the panel's stops and wraps, so focus never leaves it. Handled in capture,
   * before the rows' own keys, and by hand so it works where buttons are not Tab stops (WebKit).
   */
  function trapTab(e: KeyboardEvent<HTMLDivElement>): void {
    const node = pop.current
    if (!node) return
    const pick = (selector: string): HTMLElement | null => node.querySelector<HTMLElement>(selector)
    const rows = [...node.querySelectorAll<HTMLElement>('[data-menu-row]')]
    const menu = rows[0]?.closest<HTMLElement>('[role="menu"]') ?? null
    const stops: { group: HTMLElement | null; enter: (back: boolean) => HTMLElement | null }[] = panel === 'switch'
      ? [
          { group: back.current, enter: () => back.current },
          { group: accountsMenu.current, enter: () => accountsMenu.current?.querySelector<HTMLElement>('[tabindex="0"]') ?? null },
        ]
      : [
          { group: pick('[role="radiogroup"][aria-label="Status"]'), enter: () => pick('[aria-label="Status"] [tabindex="0"]') },
          { group: pick('[role="radiogroup"][aria-label="Theme"]'), enter: () => pick('[aria-label="Theme"] [tabindex="0"]') },
          { group: menu, enter: (backwards) => (backwards ? rows.at(-1) : rows[0]) ?? null },
          { group: pick('[data-sign-out]'), enter: () => pick('[data-sign-out]') },
        ]
    const live = stops.filter((stop) => stop.group)
    if (!live.length) return
    e.preventDefault()
    const at = live.findIndex((stop) => stop.group?.contains(document.activeElement))
    const step = e.shiftKey ? -1 : 1
    const next = live[((at === -1 ? (e.shiftKey ? 0 : -1) : at) + step + live.length) % live.length]
    next?.enter(e.shiftKey)?.focus({ preventScroll: true })
  }

  function onPanelKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key !== 'Escape') return
    e.preventDefault()
    if (panel === 'switch') leaveSwitch()
    else shut()
  }

  /** Switch account is a menu of radios: arrows, Home, End and type ahead. */
  function onAccountsKey(e: KeyboardEvent<HTMLDivElement>): void {
    const list = [...(accountsMenu.current?.querySelectorAll<HTMLElement>('[data-account-row]') ?? [])]
    const at = list.indexOf(document.activeElement as HTMLElement)
    const move = (next: HTMLElement | undefined): void => { e.preventDefault(); next?.focus({ preventScroll: true }) }
    switch (e.key) {
      case 'ArrowDown': move(list[(at + 1) % list.length]); return
      case 'ArrowUp': move(list[at <= 0 ? list.length - 1 : at - 1]); return
      case 'Home': move(list[0]); return
      case 'End': move(list.at(-1)); return
      case 'ArrowLeft': e.preventDefault(); leaveSwitch(); return
      default: {
        if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.key === ' ') return
        const now = Date.now()
        const text = now - typed.current.at > TYPE_RESET_MS ? e.key : typed.current.text + e.key
        typed.current = { text, at: now }
        list.find((row) => row.dataset.label?.toLowerCase().startsWith(text.toLowerCase()))?.focus({ preventScroll: true })
      }
    }
  }

  const entries: MenuEntry[] = [
    { label: 'Profile', icon: <UserIcon />, ...(onProfile ? { onSelect: onProfile } : {}) },
    { label: 'Settings', icon: <SettingsIcon />, shortcut: ['⌘', ','], ...(onSettings ? { onSelect: onSettings } : {}) },
    { label: 'Billing', icon: <CreditCardIcon />, ...(onBilling ? { onSelect: onBilling } : {}) },
    { id: 'switch', label: 'Switch account', icon: <ExchangeIcon />, chevron: true, onSelect: () => { switching.current = true; setPanel('switch') } },
  ]

  const avatar = (who: ProfileAccount, size: 'sm' | 'md', badge?: AvatarBadgeType): ReactNode => (
    <Avatar initials={who.initials} size={size} animated={animated} {...(badge ? { badge, badgeLabel: STATUS_NAME[currentStatus] } : {})} />
  )
  const who = (person: ProfileAccount, className?: string): ReactNode => (
    <span className={cx(styles.who, className)}><strong>{person.name}</strong><span>{person.email}</span></span>
  )
  const slide = { duration: still ? 0 : PANEL_S, ease: ease.out }
  const quiet = { opacity: 0, transition: { duration: 0 } }

  return (
    <div ref={root} className={cx(styles.root, className)} data-still={still ? '' : undefined}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${uid}-menu` : undefined}
        data-open={open ? '' : undefined}
        onClick={(e) => { e.currentTarget.focus(); setFocusRows(false); if (open) close(); else setOpen(true) }}
        onKeyDown={(e) => {
          if (open && e.key === 'Escape') { e.preventDefault(); shut() }
          if (!open && ['ArrowDown', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setFocusRows(true); setOpen(true) }
        }}
      >
        {avatar(account, 'sm', BADGE[currentStatus])}
        {who(account, styles.triggerWho)}
        <motion.span className={styles.turn} initial={false} animate={{ rotate: open ? 0 : 180 }} transition={{ duration: still ? 0 : duration.open, ease: ease.out }}><ChevronUpIcon /></motion.span>
      </button>
      <span className={styles.srOnly} aria-live="polite">{announce}</span>
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={pop}
            id={`${uid}-menu`}
            role="dialog"
            aria-label="Account"
            className={styles.pop}
            onKeyDown={onPanelKey}
            onKeyDownCapture={(e) => { if (e.key === 'Tab') trapTab(e) }}
            initial={fade ? { opacity: 0 } : still ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={still && !fade ? quiet : { opacity: 0, transition: { duration: duration.close } }}
            transition={{ duration: still && !fade ? 0 : duration.open, ease: ease.out }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {panel === 'main' ? (
                <motion.div key="main" className={styles.panel} initial={still ? false : { opacity: 0, x: -PANEL_X }} animate={{ opacity: 1, x: 0 }} exit={still ? quiet : { opacity: 0, x: -PANEL_X }} transition={slide}>
                  <div className={styles.block}>
                    <div className={styles.card}>
                      {avatar(account, 'md', BADGE[currentStatus])}
                      {who(account, styles.cardWho)}
                      <span className={styles.plan}>{plan}</span>
                    </div>
                    <div className={styles.setting}>
                      <span className={styles.settingName}>Status</span>
                      <ToggleGroup
                        type="single"
                        label="Status"
                        className={cx(styles.statusGroup)}
                        animated={animated}
                        value={currentStatus}
                        items={[{ value: 'online', label: 'Online' }, { value: 'away', label: 'Away' }, { value: 'dnd', label: 'DND', ariaLabel: 'Do not disturb' }]}
                        onValueChange={(next) => { setHeldStatus(next as ProfileStatus); onStatusChange?.(next as ProfileStatus) }}
                      />
                    </div>
                    <div className={styles.setting}>
                      <span className={styles.settingName}>Theme</span>
                      <ToggleGroup
                        type="single"
                        label="Theme"
                        className={cx(styles.themeGroup)}
                        animated={animated}
                        value={currentTheme}
                        items={[{ value: 'light', icon: <SunIcon />, ariaLabel: 'Light' }, { value: 'dark', icon: <MoonIcon />, ariaLabel: 'Dark' }, { value: 'system', icon: <FlipHorizontalIcon />, ariaLabel: 'System' }]}
                        onValueChange={(next) => { setHeldTheme(next as ProfileTheme); onThemeChange?.(next as ProfileTheme) }}
                      />
                    </div>
                    {currentStatus === 'dnd' ? (
                      <motion.p
                        className={styles.note}
                        initial={fade ? { opacity: 0 } : still ? false : { opacity: 0, scale: NOTE_SCALE, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={fade ? { duration: duration.open } : still ? { duration: 0 } : spring.toggle}
                      >
                        <span className={styles.noteIcon}><BellOffIcon /></span>
                        <span>{pausedNote}</span>
                      </motion.p>
                    ) : null}
                  </div>
                  <Menu
                    className={cx(styles.rows)}
                    entries={entries}
                    label={account.name}
                    store={store}
                    still={still}
                    focusOn={focusRows ? 'first' : 'none'}
                    onClose={(how) => {
                      // Tab walks on to Sign out, and Switch account keeps the menu open.
                      if (how === 'tab' || switching.current) return
                      shut()
                    }}
                  />
                  <div role="separator" className={styles.separator} />
                  <HoldToSignOut still={still} onDone={() => { setAnnounce('Signed out'); shut(); onSignOut?.() }} />
                </motion.div>
              ) : (
                <motion.div key="switch" className={styles.panel} initial={still ? false : { opacity: 0, x: PANEL_X }} animate={{ opacity: 1, x: 0 }} exit={still ? quiet : { opacity: 0, x: PANEL_X }} transition={slide}>
                  <div className={styles.head}>
                    <IconButton ref={back} variant="ghost" size="sm" label="Back" icon={<ChevronLeftIcon />} animated={animated} className={styles.back} onClick={leaveSwitch} />
                    <span>Switch account</span>
                  </div>
                  <div role="separator" className={styles.separator} />
                  <div ref={accountsMenu} className={styles.accounts} role="menu" aria-label="Accounts" onKeyDown={onAccountsKey}>
                    {[account, ...accounts].map((person) => (
                      <AccountRow
                        key={person.id}
                        person={person}
                        current={person.id === account.id}
                        still={still}
                        badge={person.id === account.id ? BADGE[currentStatus] : undefined}
                        avatar={(p, b) => avatar(p, 'sm', b)}
                        onPick={() => { if (person.id !== account.id) onSwitchAccount?.(person); shut() }}
                      />
                    ))}
                    <div role="separator" className={styles.separator} />
                    <button type="button" role="menuitem" tabIndex={-1} className={styles.accountRow} data-account-row="" data-label="Add account" data-add="" onPointerMove={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.focus({ preventScroll: true }) }} onClick={() => { onAddAccount?.(); shut() }}>
                      <span className={styles.addIcon}><PlusIcon /></span>
                      <span className={styles.addLabel}>Add account</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
