'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { delay, duration, ease, scalePress, spring } from '../../motion-tokens'
import { useLabelMotion } from '../button/label-motion'
import { useStill } from '../motion-kit/use-still'
import { rovingTarget } from '../toggle-group/roving'
import styles from './button-group.module.css'

type GroupButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & { text?: string | undefined; swap?: boolean; icon?: ReactNode; underlay?: ReactNode; still: boolean }

/** One button inside a group: a label that draws and waves like Button's. */
function GroupButton({ text, swap = false, icon, underlay, still, className, disabled, onKeyDown, ...rest }: GroupButtonProps) {
  const motionLabel = useLabelMotion(text ?? null, !disabled && !still, swap)
  const [leaving, setLeaving] = useState<string | null>(null)
  const lastText = useRef(text)

  useLayoutEffect(() => {
    if (lastText.current === text) return
    if (swap && !still && !disabled) setLeaving(lastText.current ?? null)
    lastText.current = text
  }, [text, swap, still, disabled])

  const { handlers } = motionLabel
  return (
    <motion.button
      type="button"
      disabled={disabled}
      className={className}
      {...rest}
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={handlers.onPointerLeave}
      onPointerDown={handlers.onPointerDown}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => { onKeyDown?.(e); handlers.onKeyDown(e) }}
    >
      {underlay}
      {icon ? <span className={styles.icon}>{icon}</span> : null}
      {text ? <span className={styles.label}>
        {motionLabel.label}
        {leaving ? (
          <motion.span
            key={leaving}
            aria-hidden="true"
            className={styles.leaving}
            initial={{ opacity: 1, filter: 'blur(0px)' }}
            animate={{ opacity: 0, filter: 'blur(6px)' }}
            transition={{ duration: duration.base, ease: ease['out-soft'] }}
            onAnimationComplete={() => setLeaving(null)}
          >
            {leaving}
          </motion.span>
        ) : null}
      </span> : null}
    </motion.button>
  )
}

type Shared = {
  /** The group's accessible name. */
  label: string
  /** `false` turns off the press scale, the sliding card and the label motion. */
  animated?: boolean
  className?: string
}

export type SegmentedGroupProps = Shared & {
  kind: 'segmented'
  options: { value: string; label: string; disabled?: boolean }[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

type AttachedItemProps = {
  label?: string
  /** Shown for 1.6 s after a click, in past tense: Download becomes Downloaded. */
  doneLabel?: string
  icon?: ReactNode
  ariaLabel?: string
  onClick?: () => void
  disabled?: boolean
}

export type AttachedGroupProps = Shared & {
  kind: 'attached'
  items: AttachedItemProps[]
}

export type SplitGroupProps = Shared & {
  kind: 'split'
  /** The main action's text. */
  action: string
  icon?: ReactNode
  onAction?: () => void
  menuLabel: string
  onMenu?: () => void
  disabled?: boolean
}

export type ToolbarGroupProps = Shared & {
  kind: 'toolbar'
  /** `'separator'` draws a hairline between tools. */
  items: ({ label: string; icon: ReactNode; pressed: boolean; onPressedChange: (pressed: boolean) => void; disabled?: boolean } | 'separator')[]
}

export type ButtonGroupProps = SegmentedGroupProps | AttachedGroupProps | SplitGroupProps | ToolbarGroupProps

/** An Attached button. After a click it holds `doneLabel`, easing its width between the two words. */
function AttachedItem({ item, still }: { item: AttachedItemProps; still: boolean }) {
  const [done, setDone] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const width = useRef<number | null>(null)
  const resize = useRef<Animation | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const text = done && item.doneLabel ? item.doneLabel : item.label

  useEffect(() => () => { clearTimeout(timer.current); resize.current?.cancel() }, [])

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    resize.current?.cancel()
    const next = element.offsetWidth
    const from = width.current
    width.current = next
    if (still || from === null || from === next) return
    // A native animation leaves no inline width, so the button keeps following its tokens.
    resize.current = element.animate(
      [{ width: `${from}px` }, { width: `${next}px` }],
      { duration: duration.slow * 1000, easing: `cubic-bezier(${ease['out-soft'].join(', ')})` },
    )
  }, [text, still])

  function handleClick(): void {
    item.onClick?.()
    if (!item.doneLabel) return
    setDone(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setDone(false), delay.reset * 1000)
  }

  return (
    <>
      <GroupButton
        ref={ref}
        text={text}
        swap={Boolean(item.doneLabel)}
        icon={item.icon}
        aria-label={item.ariaLabel}
        disabled={item.disabled}
        still={still}
        className={styles.item}
        onClick={handleClick}
      />
      {item.doneLabel ? <span role="status" className={styles.srOnly}>{done ? item.doneLabel : ''}</span> : null}
    </>
  )
}

function Segmented({ label, options, value, defaultValue, onValueChange, still, className }: SegmentedGroupProps & { still: boolean }) {
  const id = useId()
  const [held, setHeld] = useState(defaultValue ?? options[0]?.value)
  const current = value ?? held

  function choose(next: string): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    const next = rovingTarget(e)
    if (!next) return
    e.preventDefault()
    next.focus()
    next.click()
  }

  // A disabled choice cannot hold the Tab stop.
  const stop = options.find((option) => option.value === current && !option.disabled) ?? options.find((option) => !option.disabled)

  return (
    <div role="radiogroup" aria-label={label} data-roving-group="" className={[styles.tray, className].filter(Boolean).join(' ')}>
      {options.map((option) => {
        const on = option.value === current
        return (
          <GroupButton
            key={option.value}
            role="radio"
            aria-checked={on}
            tabIndex={option === stop ? 0 : -1}
            data-roving=""
            text={option.label}
            still={still}
            disabled={option.disabled}
            className={styles.segment}
            underlay={on ? <motion.span {...(still ? {} : { layoutId: `${id}-card` })} className={styles.card} transition={spring.slide} /> : null}
            onClick={() => choose(option.value)}
            onKeyDown={onKeyDown}
          />
        )
      })}
    </div>
  )
}

function Toolbar({ label, items, still, className }: ToolbarGroupProps & { still: boolean }) {
  const [focused, setFocused] = useState(0)
  const open = (i: number): boolean => { const item = items[i]; return item !== undefined && item !== 'separator' && !item.disabled }
  const stop = open(focused) ? focused : items.findIndex((_, i) => open(i))

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    const next = rovingTarget(e)
    if (!next) return
    e.preventDefault()
    next.focus()
  }

  return (
    <div role="toolbar" aria-label={label} data-roving-group="" className={[styles.tray, className].filter(Boolean).join(' ')}>
      {items.map((item, i) => (item === 'separator' ? <span key={i} aria-hidden="true" className={styles.toolDivider} /> : (
        <motion.button
          key={item.label}
          type="button"
          aria-label={item.label}
          aria-pressed={item.pressed}
          data-on={item.pressed ? '' : undefined}
          data-roving=""
          tabIndex={i === stop ? 0 : -1}
          disabled={item.disabled}
          className={styles.tool}
          onClick={() => item.onPressedChange(!item.pressed)}
          onFocus={() => setFocused(i)}
          onKeyDown={onKeyDown}
          {...(still || item.disabled ? {} : { whileTap: { scale: 0.96 } })}
          transition={spring.toggle}
        >
          <span className={styles.icon}>{item.icon}</span>
        </motion.button>
      )))}
    </div>
  )
}

/** Related actions in one shape: Segmented, Attached, Split or Toolbar. */
export function ButtonGroup(props: ButtonGroupProps) {
  const still = useStill(props.animated !== false)
  // Motion makes a pressable element focusable, so -1 keeps the wrapper out of the tab order.
  const press = still ? {} : { tabIndex: -1, whileTap: { scale: scalePress }, transition: spring.press }

  if (props.kind === 'segmented') return <Segmented {...props} still={still} />
  if (props.kind === 'toolbar') return <Toolbar {...props} still={still} />

  if (props.kind === 'attached') {
    return (
      <motion.div role="group" aria-label={props.label} className={[styles.attached, props.className].filter(Boolean).join(' ')} {...press}>
        {props.items.map((item, i) => (
          <span key={item.label ?? item.ariaLabel ?? i} className={styles.part}>
            {i > 0 ? <span aria-hidden="true" className={styles.hairline} /> : null}
            <AttachedItem item={item} still={still} />
          </span>
        ))}
      </motion.div>
    )
  }

  return (
    <motion.div role="group" aria-label={props.label} className={[styles.split, props.className].filter(Boolean).join(' ')} {...press}>
      <GroupButton text={props.action} icon={props.icon} disabled={props.disabled} still={still} className={styles.main} onClick={props.onAction} />
      <span aria-hidden="true" className={styles.splitDivider} />
      <button type="button" aria-haspopup="menu" aria-label={props.menuLabel} disabled={props.disabled} className={styles.menu} onClick={props.onMenu}>
        <span className={styles.chevron}><ChevronUpIcon /></span>
      </button>
    </motion.div>
  )
}
