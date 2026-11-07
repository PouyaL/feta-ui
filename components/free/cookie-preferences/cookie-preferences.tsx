'use client'
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { LockIcon } from '@fetaui/react/rounded/lock'
import { XIcon } from '@fetaui/react/rounded/x'
import { ease } from '../../motion-tokens'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Switch } from '../switch/switch'
import styles from './cookie-preferences.module.css'

/** Popover opens in 180 ms, and the sheet on Mobile slides up in 280 ms. Both leave in the close time. */
const OPEN_MS = 180
const SHEET_MS = 280
const CLOSE_MS = 180
const POPOVER_SCALE = 0.98

export type CookieCategory = {
  id: string
  title: string
  description: string
  /** Cannot be turned off. Shows the Always on chip. */
  locked?: boolean
}

export const COOKIE_CATEGORIES: CookieCategory[] = [
  { id: 'necessary', title: 'Strictly necessary', description: 'Sign in, security and your cart. The site can\'t work without these.', locked: true },
  { id: 'preferences', title: 'Preferences', description: 'Remember your language, region and display settings.' },
  { id: 'analytics', title: 'Analytics', description: 'Count visits and see which pages help, only in aggregate.' },
  { id: 'marketing', title: 'Marketing', description: 'Measure campaigns and show relevant ads on other sites.' },
]

/** The ids that are on. */
export type CookieChoices = string[]

export type CookiePreferencesPanelProps = {
  title?: ReactNode
  description?: ReactNode
  categories?: CookieCategory[]
  /** Optional ids that start on. Optional cookies start off. */
  defaultValue?: CookieChoices
  /** Runs for Save, Reject all and Accept all. Every action holds until the promise settles. */
  onSave?: (choices: CookieChoices) => Promise<void> | void
  /** Shows the close Icon Button. */
  onClose?: () => void
  /** Holds every action, for when saving is controlled outside. */
  saving?: boolean
  /** Draws the focus ring on one category, for specimens. */
  focusCategory?: string
  animated?: boolean
  className?: string
}

/** The panel inside Cookie Preferences: categories in an inset card, with Save counting the choices. */
export function CookiePreferencesPanel({ title = 'Cookie preferences', description = 'Choose which optional cookies we can use. You can change this any time.', categories = COOKIE_CATEGORIES, defaultValue = [], onSave, onClose, saving = false, focusCategory, animated = true, className }: CookiePreferencesPanelProps) {
  const id = useId()
  const [on, setOn] = useState<CookieChoices>(defaultValue)
  const [busy, setBusy] = useState(false)
  // Which button started the save, so only that one spins.
  const [pressed, setPressed] = useState<'reject' | 'accept' | 'save'>('save')
  const holding = saving || busy
  const optional = categories.filter(({ locked }) => !locked).map(({ id: key }) => key)
  const locked = categories.filter((item) => item.locked).map(({ id: key }) => key)

  async function save(next: CookieChoices): Promise<void> {
    if (holding) return
    setBusy(true)
    try {
      await onSave?.([...locked, ...next])
    } finally {
      setBusy(false)
    }
  }

  const count = on.length
  const saveLabel = count === 0 ? 'Save choices' : `Save ${count} ${count === 1 ? 'choice' : 'choices'}`

  return (
    <div className={cx(styles.tray, className)} data-panel="">
      <span className={styles.grabber} aria-hidden="true" />
      <div className={styles.header}>
        <h2 id={`${id}-title`} className={styles.title}>{title}</h2>
        {onClose ? <IconButton className={styles.close} variant="ghost" size="sm" icon={<XIcon />} label="Close" disabled={holding} animated={animated} onClick={onClose} /> : null}
      </div>
      <p className={styles.intro}>{description}</p>
      <ul className={styles.list} aria-labelledby={`${id}-title`}>
        {categories.map((item) => (
          <li key={item.id} className={styles.row} data-focus={focusCategory === item.id ? '' : undefined}>
            <div className={styles.text}>
              <p id={`${id}-${item.id}`} className={styles.rowTitle}>{item.title}</p>
              <p id={`${id}-${item.id}-text`} className={styles.rowText}>{item.description}</p>
            </div>
            {item.locked ? <span className={styles.always}><LockIcon size={12} />Always on</span> : (
              <Switch
                aria-labelledby={`${id}-${item.id}`}
                aria-describedby={`${id}-${item.id}-text`}
                checked={on.includes(item.id)}
                disabled={holding}
                animated={animated}
                onCheckedChange={(checked) => setOn(checked ? [...on, item.id] : on.filter((key) => key !== item.id))}
              />
            )}
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <Button variant="secondary" size="sm" shape="pill" disabled={holding && pressed !== 'reject'} animated={animated} status={holding && pressed === 'reject' ? 'loading' : 'idle'} loadingLabel="Saving" onClick={() => { setPressed('reject'); void save([]) }}>Reject all</Button>
        <Button variant="secondary" size="sm" shape="pill" disabled={holding && pressed !== 'accept'} animated={animated} status={holding && pressed === 'accept' ? 'loading' : 'idle'} loadingLabel="Saving" onClick={() => { setPressed('accept'); void save(optional) }}>Accept all</Button>
        <Button className={styles.save} size="sm" shape="pill" disabled={holding && pressed !== 'save'} status={holding && pressed === 'save' ? 'loading' : 'idle'} loadingLabel="Saving" animated={animated} onClick={() => { setPressed('save'); void save(on) }}>{saveLabel}</Button>
      </div>
    </div>
  )
}

export type CookiePreferencesProps = Omit<CookiePreferencesPanelProps, 'onClose' | 'focusCategory' | 'saving' | 'className'> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fires once it has fully closed. */
  onClosed?: () => void
  className?: string
}

/** A dialog on the panel: a popover at the corner on Web and a bottom sheet on Mobile. Traps focus and returns it on close. */
export function CookiePreferences({ open, onOpenChange, onClosed, onSave, animated = true, className, ...panel }: CookiePreferencesProps) {
  const still = useStill(animated)
  const dialog = useRef<HTMLDialogElement>(null)
  const saving = useRef(false)
  const [mounted, setMounted] = useState(false)
  const closed = useRef(onClosed)
  useEffect(() => { closed.current = onClosed })

  useEffect(() => {
    const node = dialog.current
    if (!node) return
    const sheet = Boolean(node.closest('[data-platform="mobile"]')) || window.matchMedia('(max-width: 640px)').matches
    const from = sheet ? { opacity: 0, transform: 'translateY(100%)' } : { opacity: 0, transform: `scale(${POPOVER_SCALE})` }
    const to = { opacity: 1, transform: sheet ? 'translateY(0)' : 'scale(1)' }
    const timing = { easing: `cubic-bezier(${ease.out.join(',')})`, fill: 'both' as const }
    if (open && !node.open) {
      setMounted(true)
      node.showModal()
      if (!still) node.animate([from, to], { ...timing, duration: sheet ? SHEET_MS : OPEN_MS })
      return
    }
    if (!open && node.open) {
      const finish = (): void => { node.close(); setMounted(false); closed.current?.() }
      if (still) { finish(); return }
      void node.animate([to, from], { ...timing, duration: CLOSE_MS }).finished.then(finish, () => undefined)
    }
  }, [open, still])

  function outside(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === dialog.current && !saving.current) onOpenChange(false)
  }

  async function save(choices: CookieChoices): Promise<void> {
    saving.current = true
    try {
      await onSave?.(choices)
      onOpenChange(false)
    } finally {
      saving.current = false
    }
  }

  return (
    <dialog
      ref={dialog}
      className={cx(styles.dialog, className)}
      aria-label="Cookie preferences"
      onClick={outside}
      onCancel={(event) => { event.preventDefault(); if (!saving.current) onOpenChange(false) }}
    >
      {open || mounted ? <CookiePreferencesPanel {...panel} onSave={save} onClose={() => onOpenChange(false)} animated={animated} /> : null}
    </dialog>
  )
}
