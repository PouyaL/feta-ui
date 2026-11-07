'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { LoaderIcon } from '@fetaui/react/rounded/loader'
import { SearchIcon } from '@fetaui/react/rounded/search'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { XIcon } from '@fetaui/react/rounded/x'
import { duration, ease, spring } from '../../motion-tokens'
import { form, useFieldControl } from '../form-kit/form-kit'
import { useDismiss } from '../form-kit/use-dismiss'
import { useMessageClearance } from '../form-kit/use-message-clearance'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './combobox.module.css'

export type ComboboxOption = { value: string; label: string; description?: string; avatar?: string; disabled?: boolean }

type Shared = {
  options: ComboboxOption[]
  placeholder?: string
  /** Remote lists: the spinner shows in the field and the list. */
  loading?: boolean
  /** Fires as the typed text changes, and with an empty string when the list closes. Use it to fetch remote options. */
  onQueryChange?: (query: string) => void
  /** `false` shows `options` as given, for lists the server already filtered. Default true. */
  filter?: boolean
  /** What to show when nothing matches. */
  empty?: ReactNode
  invalid?: boolean
  disabled?: boolean
  id?: string
  'aria-label'?: string
  animated?: boolean
  className?: string
}

export type ComboboxProps = Shared & (
  | { multiple?: false; value?: string | null; defaultValue?: string | null; onValueChange?: (value: string | null) => void; maxChips?: never }
  | { multiple: true; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void; /** Extra people fold into +N. */ maxChips?: number }
)

function Highlight({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return <>{text.slice(0, at)}<strong className={styles.match}>{text.slice(at, at + query.length)}</strong>{text.slice(at + query.length)}</>
}

/** An input that filters a list as you type. */
export function Combobox(props: ComboboxProps) {
  const { options, placeholder = 'Search', loading, onQueryChange, filter = true, empty = 'No results', invalid, disabled, id, 'aria-label': label, animated = true, className } = props
  const still = useStill(animated)
  const field = useFieldControl({ id, invalid, disabled })
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [heldOne, setHeldOne] = useState(!props.multiple ? props.defaultValue ?? null : null)
  const [heldMany, setHeldMany] = useState(props.multiple ? props.defaultValue ?? [] : [])
  const [active, setActive] = useState(0)
  const selected: string[] = props.multiple
    ? props.value ?? heldMany
    : [props.value === undefined ? heldOne : props.value].filter((v): v is string => Boolean(v))
  const single = !props.multiple ? options.find((o) => o.value === selected[0]) : undefined
  const typing = !single || query !== single.label
  const shown = useMemo(() => {
    if (!filter || !typing || !query) return options
    const q = query.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q))
  }, [options, query, typing, filter])
  const queryChange = useRef(onQueryChange)
  queryChange.current = onQueryChange
  const lastQuery = useRef('')
  const ask = useCallback((next: string) => {
    setQuery(next)
    if (lastQuery.current === next) return
    lastQuery.current = next
    queryChange.current?.(next)
  }, [])
  const close = useCallback(() => { setOpen(false); ask('') }, [ask])

  useDismiss(root, open, close)

  useEffect(() => {
    if (!open) return
    list.current?.children.item(active)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function emit(next: string[]): void {
    if (props.multiple) {
      setHeldMany(next)
      props.onValueChange?.(next)
    } else {
      const one = next[0] ?? null
      setHeldOne(one)
      props.onValueChange?.(one)
    }
  }

  function pick(option: ComboboxOption | undefined): void {
    if (!option || option.disabled) return
    if (props.multiple) {
      emit(selected.includes(option.value) ? selected.filter((v) => v !== option.value) : [...selected, option.value])
      ask('')
      setActive(0)
      input.current?.focus()
    } else {
      emit([option.value])
      close()
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((at) => Math.min(shown.length - 1, at + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((at) => Math.max(0, at - 1)) }
    else if (e.key === 'Enter') { if (open) { e.preventDefault(); pick(shown[active]) } }
    else if (e.key === 'Escape' || e.key === 'Tab') { close() }
    else if (e.key === 'Backspace' && props.multiple && !query) emit(selected.slice(0, -1))
  }

  useMessageClearance({ open, enabled: true, invalid: field.invalid, describedBy: field.describedBy, trigger: box, popup })

  const listId = `${uid}-list`
  const optionId = (i: number): string => `${uid}-option-${i}`
  const limit = props.multiple ? props.maxChips ?? Infinity : Infinity
  const chips = props.multiple ? selected.slice(0, limit) : []
  const fold = props.multiple ? Math.max(0, selected.length - limit) : 0

  return (
    <div ref={root} className={cx(styles.combobox, className)}>
      <div
        ref={box}
        className={cx(form.pill, styles.field)}
        data-open={open ? '' : undefined}
        data-invalid={field.invalid ? '' : undefined}
        data-disabled={field.disabled ? '' : undefined}
        data-still={still ? '' : undefined}
        onClick={() => { if (field.disabled) return; input.current?.focus(); setOpen(true) }}
      >
        <span className={form.quiet}>{loading ? <span className={styles.spin}><LoaderIcon trigger="none" /></span> : <SearchIcon trigger="none" />}</span>
        <AnimatePresence initial={false} mode="popLayout">
          {chips.map((value) => {
            const option = options.find((o) => o.value === value)
            return (
              <motion.span
                key={value}
                layout={!still}
                className={styles.chip}
                initial={still ? false : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={still ? { opacity: 0, transition: { duration: 0 } } : { scale: 0.8, opacity: 0 }}
                transition={spring.pop}
              >
                {option?.avatar ? <span className={styles.avatar} aria-hidden="true">{option.avatar}</span> : null}
                {option?.label ?? value}
                <button type="button" className={styles.remove} aria-label={`Remove ${option?.label ?? value}`} disabled={field.disabled} onClick={(e) => { e.stopPropagation(); emit(selected.filter((v) => v !== value)) }}>
                  <XIcon trigger="none" />
                </button>
              </motion.span>
            )
          })}
        </AnimatePresence>
        {fold ? <span className={styles.more}>+{fold}</span> : null}
        <input
          ref={input}
          id={field.id}
          role="combobox"
          aria-expanded={open}
          aria-controls={open && shown.length ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? optionId(active) : undefined}
          aria-label={label}
          aria-invalid={field.invalid || undefined}
          aria-describedby={field.describedBy}
          autoComplete="off"
          className={form.entry}
          disabled={field.disabled}
          placeholder={selected.length ? '' : placeholder}
          value={open || !single ? query : single.label}
          onFocus={() => setOpen(true)}
          onChange={(e) => { ask(e.target.value); setActive(0); setOpen(true) }}
          onKeyDown={onKeyDown}
        />
        {!props.multiple && single ? (
          <IconButton variant="ghost" size="sm" animated={animated} label="Clear" className={styles.clear} disabled={field.disabled} icon={<XIcon trigger="none" />} onClick={(e) => { e.stopPropagation(); emit([]); ask('') }} />
        ) : null}
        <motion.span className={form.quiet} initial={false} animate={{ rotate: open ? 0 : 180 }} transition={{ duration: still ? 0 : duration.fast, ease: ease.out }}>
          <ChevronUpIcon trigger="none" />
        </motion.span>
      </div>
      <span className={form.srOnly} role="status">{open ? `${shown.length} ${shown.length === 1 ? 'result' : 'results'}` : ''}</span>
      <AnimatePresence>
        {open ? (
          <motion.div
            ref={popup}
            className={cx(form.pop, styles.pop)}
            initial={still ? { opacity: 1 } : { opacity: 0, scale: 0.98, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
            transition={{ duration: still ? 0 : duration.base, ease: ease.out }}
          >
            {shown.length ? (
              <div ref={list} id={listId} role="listbox" aria-label={label ?? placeholder} aria-multiselectable={props.multiple || undefined} className={styles.list}>
                {shown.map((option, i) => {
                  const on = selected.includes(option.value)
                  return (
                    <div
                      key={option.value}
                      id={optionId(i)}
                      role="option"
                      aria-selected={on}
                      aria-disabled={option.disabled || undefined}
                      className={cx(form.item, styles.item)}
                      onPointerEnter={() => setActive(i)}
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={() => pick(option)}
                    >
                      {i === active ? <motion.span {...(still ? {} : { layoutId: `${uid}-glide` })} className={form.glide} transition={spring.jump} /> : null}
                      {option.avatar ? <span className={styles.avatar} aria-hidden="true">{option.avatar}</span> : null}
                      <span className={form.itemBody}>
                        <span className={styles.title}><Highlight text={option.label} query={typing ? query : ''} /></span>
                        {option.description ? <span className={styles.description}>{option.description}</span> : null}
                      </span>
                      {on ? <span className={form.check}><Tick02Icon trigger="none" /></span> : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={styles.empty}>{loading ? 'Searching' : empty}</div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
