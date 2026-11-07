'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { XIcon } from '@fetaui/react/rounded/x'
import { duration, ease, spring } from '../../motion-tokens'
import { form, useFieldControl } from '../form-kit/form-kit'
import { useDismiss } from '../form-kit/use-dismiss'
import { useMessageClearance } from '../form-kit/use-message-clearance'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './select.module.css'

const TYPE_RESET_MS = 600

export type SelectOption = { value: string; label: string; icon?: ReactNode; disabled?: boolean }
export type SelectGroup = { label: string; options: SelectOption[] }

export type SelectProps = {
  /** A flat list, or groups with mono labels. */
  options: (SelectOption | SelectGroup)[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Pick several: chips sit in the field, checks in the list, and the list stays open. */
  multiple?: boolean
  values?: string[]
  defaultValues?: string[]
  onValuesChange?: (values: string[]) => void
  placeholder?: string
  /** `field` matches Input, `pill` sits inline in properties, `native` keeps the platform control. */
  kind?: 'field' | 'pill' | 'native'
  /** `trigger` lays the list over the trigger, with the chosen row on it. Default `below`. */
  align?: 'below' | 'trigger'
  /** Starts open, for a list shown in place. */
  defaultOpen?: boolean
  /** The list's tallest height in px, before it scrolls. */
  listHeight?: number
  /** A row under the list. Multiple gets the count and `clear`. */
  footer?: ReactNode | ((state: { count: number; clear: () => void }) => ReactNode)
  /** Leading icon on the `pill` trigger. */
  icon?: ReactNode
  invalid?: boolean
  disabled?: boolean
  id?: string
  'aria-label'?: string
  animated?: boolean
  className?: string
}

const isGroup = (entry: SelectOption | SelectGroup): entry is SelectGroup => 'options' in entry

/** Choose one value from a list. The list grows out of the trigger and the highlight glides. */
export function Select({ options, value, defaultValue, onValueChange, multiple = false, values, defaultValues = [], onValuesChange, placeholder = 'Select', kind = 'field', align = 'below', defaultOpen = false, listHeight, footer, icon, invalid, disabled, id, 'aria-label': label, animated = true, className }: SelectProps) {
  const still = useStill(animated)
  const field = useFieldControl({ id, invalid, disabled })
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const [held, setHeld] = useState(defaultValue)
  const [heldMany, setHeldMany] = useState(defaultValues)
  const [open, setOpen] = useState(defaultOpen)
  const flat = useMemo(() => options.flatMap((entry) => (isGroup(entry) ? entry.options : [entry])), [options])
  const enabled = useMemo(() => flat.filter((option) => !option.disabled), [flat])
  const position = useMemo(() => new Map(flat.map((option, i) => [option.value, i])), [flat])
  const current = value ?? held
  const many = values ?? heldMany
  const selected = flat.find((option) => option.value === current)
  const [active, setActive] = useState(current ?? enabled[0]?.value)
  const close = useCallback(() => setOpen(false), [])

  useDismiss(root, open, close)

  useEffect(() => {
    if (!open) return
    // Scrolls the list only: a list open on load must not move the page.
    const box = list.current
    const row = box?.querySelector<HTMLElement>(`[data-value="${CSS.escape(active ?? '')}"]`)
    if (!box || !row) return
    const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop
    if (top < box.scrollTop) box.scrollTop = top
    else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight
  }, [open, active])

  useLayoutEffect(() => {
    if (!open || align !== 'trigger' || !popup.current) return
    const row = list.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    const trigger = root.current?.querySelector<HTMLElement>('[role="combobox"]')
    if (row && trigger) popup.current.style.top = `${trigger.offsetHeight / 2 - (row.offsetTop + row.offsetHeight / 2)}px`
  }, [open, align])

  useMessageClearance({ open, enabled: align === 'below', invalid: field.invalid, describedBy: field.describedBy, trigger, popup })

  function show(): void {
    setActive(current ?? enabled[0]?.value)
    setOpen(true)
  }

  function setMany(next: string[]): void {
    setHeldMany(next)
    onValuesChange?.(next)
  }

  function choose(next: string): void {
    if (multiple) {
      setMany(many.includes(next) ? many.filter((v) => v !== next) : [...many, next])
      return
    }
    setHeld(next)
    onValueChange?.(next)
    setOpen(false)
  }

  function move(step: number): void {
    const at = enabled.findIndex((option) => option.value === active)
    const next = enabled[Math.min(enabled.length - 1, Math.max(0, at + step))]
    if (next) setActive(next.value)
  }

  function typeahead(char: string): void {
    const now = Date.now()
    const text = now - typed.current.at > TYPE_RESET_MS ? char : typed.current.text + char
    typed.current = { text, at: now }
    const match = enabled.find((option) => option.label.toLowerCase().startsWith(text.toLowerCase()))
    if (match) setActive(match.value)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); show() }
      if (e.key === 'Backspace' && multiple) setMany(many.slice(0, -1))
      return
    }
    const actions: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Home: () => setActive(enabled[0]?.value),
      End: () => setActive(enabled.at(-1)?.value),
      Escape: close,
      Enter: () => { if (active) choose(active) },
      ' ': () => { if (active) choose(active) },
    }
    const action = actions[e.key]
    if (action) { e.preventDefault(); action(); return }
    if (e.key === 'Tab') { close(); return }
    if (e.key.length === 1) typeahead(e.key)
  }

  if (kind === 'native') {
    return (
      <span className={cx(form.pill, styles.native, className)} data-invalid={field.invalid ? '' : undefined} data-disabled={field.disabled ? '' : undefined} data-still={still ? '' : undefined}>
        <select
          id={field.id}
          className={styles.nativeSelect}
          aria-label={label}
          aria-invalid={field.invalid || undefined}
          aria-describedby={field.describedBy}
          disabled={field.disabled}
          value={current ?? ''}
          onChange={(e) => { setHeld(e.target.value); onValueChange?.(e.target.value) }}
        >
          {current ? null : <option value="" disabled>{placeholder}</option>}
          {options.map((entry) => (isGroup(entry)
            ? <optgroup key={entry.label} label={entry.label}>{entry.options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled ?? false}>{o.label}</option>)}</optgroup>
            : <option key={entry.value} value={entry.value} disabled={entry.disabled ?? false}>{entry.label}</option>))}
        </select>
        <span className={styles.stacked} aria-hidden="true"><ChevronUpIcon trigger="none" /><ChevronUpIcon trigger="none" /></span>
      </span>
    )
  }

  const listId = `${uid}-list`
  const optionId = (v: string): string => `${uid}-${position.get(v) ?? -1}`
  const row = (option: SelectOption): ReactNode => {
    const on = multiple ? many.includes(option.value) : option.value === current
    return (
      <div
        key={option.value}
        id={optionId(option.value)}
        role="option"
        aria-selected={on}
        aria-disabled={option.disabled || undefined}
        data-value={option.value}
        className={form.item}
        onPointerEnter={() => { if (!option.disabled) setActive(option.value) }}
        onClick={() => { if (!option.disabled) choose(option.value) }}
      >
        {active === option.value ? <motion.span {...(still ? {} : { layoutId: `${uid}-glide` })} className={form.glide} transition={spring.jump} /> : null}
        {option.icon ? <span className={cx(form.check, styles.itemIcon)}>{option.icon}</span> : null}
        <span className={form.itemBody}>{option.label}</span>
        {on ? (
          <motion.span className={form.check} initial={still ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={spring.pop}><Tick02Icon trigger="none" /></motion.span>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={root} className={cx(styles.select, className)} data-kind={kind}>
      <button
        ref={trigger}
        id={field.id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active ? optionId(active) : undefined}
        aria-label={label}
        aria-invalid={field.invalid || undefined}
        aria-describedby={multiple ? cx(field.describedBy, `${uid}-how`) : field.describedBy}
        disabled={field.disabled}
        data-open={open ? '' : undefined}
        data-invalid={field.invalid ? '' : undefined}
        data-disabled={field.disabled ? '' : undefined}
        data-still={still ? '' : undefined}
        className={cx(form.pill, styles.trigger)}
        onClick={(e) => {
          // Safari does not focus a button on click, and the keyboard needs it to.
          e.currentTarget.focus()
          if (open) close()
          else show()
        }}
        onKeyDown={onKeyDown}
      >
        {icon ?? selected?.icon ? <span className={form.quiet}>{icon ?? selected?.icon}</span> : null}
        {multiple && many.length ? (
          <span className={styles.chips}>
            <AnimatePresence initial={false} mode="popLayout">
              {many.map((v) => (
                <motion.span
                  key={v}
                  layout={!still}
                  className={styles.chip}
                  initial={still ? false : { scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={still ? { opacity: 0, transition: { duration: 0 } } : { scale: 0.8, opacity: 0 }}
                  transition={still ? { duration: 0 } : spring.pop}
                >
                  {flat.find((option) => option.value === v)?.label ?? v}
                  <span aria-hidden="true" className={styles.chipX} onClick={(e) => { e.stopPropagation(); setMany(many.filter((one) => one !== v)) }}><XIcon trigger="none" /></span>
                </motion.span>
              ))}
            </AnimatePresence>
          </span>
        ) : <span className={styles.value} data-empty={selected ? undefined : ''}>{selected?.label ?? placeholder}</span>}
        {multiple && many.length ? <span aria-hidden="true" className={cx(form.quiet, styles.chipX)} onClick={(e) => { e.stopPropagation(); setMany([]) }}><XIcon trigger="none" /></span> : null}
        {field.invalid ? <span className={form.danger}><AlertCircleIcon trigger="none" /></span> : null}
        <motion.span
          className={form.quiet}
          initial={false}
          animate={{ rotate: open ? 0 : 180 }}
          transition={{ duration: still ? 0 : duration.open, ease: ease.out }}
        >
          <ChevronUpIcon trigger="none" />
        </motion.span>
      </button>
      {multiple ? <span id={`${uid}-how`} className={form.srOnly}>{many.length ? `${many.length} chosen. Backspace removes the last one. Open the list and press Enter on a choice to remove it.` : 'Open the list and press Enter to choose.'}</span> : null}
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={popup}
            className={cx(form.pop, styles.content)}
            data-align={align}
            initial={still ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98, transition: { duration: duration.close, ease: ease.out } }}
            transition={still ? { duration: 0 } : spring.pop}
          >
            <div ref={list} id={listId} role="listbox" aria-label={label ?? placeholder} aria-multiselectable={multiple || undefined} className={styles.list} {...(listHeight ? { style: { maxHeight: listHeight } } : {})}>
              {options.map((entry) => (isGroup(entry) ? (
                <div key={entry.label} role="group" aria-label={entry.label}>
                  <div className={styles.groupLabel}>{entry.label}</div>
                  {entry.options.map(row)}
                </div>
              ) : row(entry)))}
            </div>
            {footer ? <div className={styles.footer}>{typeof footer === 'function' ? footer({ count: many.length, clear: () => setMany([]) }) : footer}</div> : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
