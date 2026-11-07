'use client'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { LockIcon } from '@fetaui/react/rounded/lock'
import { Badge } from '../badge/badge'
import { useLabelMotion } from '../button/label-motion'
import { cx, RollText, useStill } from '../motion-kit/motion-kit'
import { Spinner } from '../spinner/spinner'
import styles from './accordion.module.css'

const HOVER_INTENT_MS = 120
const NUDGE_MS = 240

export type AccordionItem = {
  value: string
  /** One line. It truncates, so move long questions to a page. */
  title: string
  /** The panel. Shown as a skeleton while `loading`. */
  children?: ReactNode
  /** Skipped by the keyboard. */
  disabled?: boolean
  /** Loader in place of the chevron, skeleton in the panel. */
  loading?: boolean
  /** Pro badge and lock. Stays focusable and calls `onLocked` instead of opening. */
  locked?: boolean
}

export type AccordionProps = {
  items: AccordionItem[]
  /** `classic` for settings and FAQs, `soft` for product surfaces, `editorial` for short lists. Default `classic`. */
  styleKind?: 'classic' | 'soft' | 'editorial'
  /** `single` closes the other item, `multiple` keeps them open. Default `single`. */
  type?: 'single' | 'multiple'
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  /** Soft: the name of the group and its meta, in the tray. */
  header?: { title: ReactNode; meta?: ReactNode }
  /** Level of the heading around each trigger. Default 3. */
  headingLevel?: 2 | 3 | 4 | 5 | 6
  /** A locked item was activated: open your upsell. */
  onLocked?: (value: string) => void
  /** `false` keeps panels, cards and labels still. The loader stays: it shows status. */
  animated?: boolean
  /** How titles move on hover: `draw` redraws the letters, `roll` rolls each title to a copy of itself, `none` keeps it still. Default `roll`, as in FAQ · Boxed. */
  labelMotion?: 'draw' | 'roll' | 'none'
  className?: string
}

function Row({ item, styleKind, labelMotion, open, headingLevel, baseId, still, onToggle, onHoverOpen, onLocked, onKeyDown }: {
  item: AccordionItem
  labelMotion: NonNullable<AccordionProps['labelMotion']>
  styleKind: NonNullable<AccordionProps['styleKind']>
  open: boolean
  headingLevel: number
  baseId: string
  still: boolean
  onToggle: () => void
  onHoverOpen: () => void
  onLocked: () => void
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void
}) {
  const { value, title, children, disabled = false, loading = false, locked = false } = item
  const editorial = styleKind === 'editorial'
  const roll = labelMotion === 'roll'
  // `none` keeps the title still, for FAQs and dense lists where only the panel should move.
  const plain = labelMotion === 'none'
  const motionLabel = useLabelMotion(title, !still && !disabled && !editorial && !roll && !plain)
  const [nudge, setNudge] = useState(0)
  const intent = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const triggerId = `${baseId}-${value}-t`
  const panelId = `${baseId}-${value}-p`
  const Heading = `h${headingLevel}` as 'h3'

  useEffect(() => () => clearTimeout(intent.current), [])
  useEffect(() => {
    if (!nudge) return
    const timer = setTimeout(() => setNudge(0), NUDGE_MS)
    return () => clearTimeout(timer)
  }, [nudge])

  function activate(): void {
    if (disabled) return
    if (locked) {
      if (!still) setNudge((n) => n + 1)
      onLocked()
      return
    }
    onToggle()
  }

  function enter(e: PointerEvent<HTMLButtonElement>): void {
    motionLabel.handlers.onPointerEnter(e)
    if (!editorial || e.pointerType !== 'mouse' || disabled || locked) return
    intent.current = setTimeout(onHoverOpen, HOVER_INTENT_MS)
  }

  return (
    <div className={styles.item} data-open={open ? '' : undefined}>
      <span aria-hidden="true" className={styles.card} />
      <Heading className={styles.heading}>
        <button
          type="button"
          id={triggerId}
          className={styles.trigger}
          aria-expanded={open}
          aria-controls={panelId}
          aria-disabled={disabled || undefined}
          aria-busy={loading || undefined}
          data-disabled={disabled ? '' : undefined}
          data-locked={locked ? '' : undefined}
          data-accordion-trigger=""
          data-roll-host={roll && !disabled ? '' : undefined}
          tabIndex={disabled ? -1 : 0}
          onClick={activate}
          onPointerEnter={enter}
          onPointerLeave={() => { clearTimeout(intent.current); motionLabel.handlers.onPointerLeave() }}
          onPointerDown={motionLabel.handlers.onPointerDown}
          onFocus={(e) => { if (editorial && !disabled && !locked && e.currentTarget.matches(':focus-visible')) onHoverOpen() }}
          onKeyDown={(e) => { motionLabel.handlers.onKeyDown(e); onKeyDown(e) }}
        >
          <span className={styles.title}>{roll ? <RollText still={still || disabled}>{title}</RollText> : editorial || plain ? title : motionLabel.label}</span>
          {locked ? <Badge size="sm" mark={false} className={styles.pro} animated={!still}>Pro</Badge> : null}
          {editorial ? null : (
            <span aria-hidden="true" className={styles.indicator} data-nudge={nudge ? '' : undefined}>
              {loading ? <Spinner size={16} label={null} className={styles.spinner} />
                : locked ? <LockIcon />
                : <span className={styles.chevron}><ChevronUpIcon /></span>}
            </span>
          )}
        </button>
      </Heading>
      <div id={panelId} role="region" aria-labelledby={triggerId} className={styles.panel} inert={!open}>
        <div className={styles.panelInner}>
          <div className={styles.content}>
            {loading ? <div aria-hidden="true" className={styles.skeleton}><span /><span /><span /></div> : children}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Headings that each reveal a panel. One family in three looks. */
export function Accordion({ items, styleKind = 'classic', type = 'single', value, defaultValue = [], onValueChange, header, headingLevel = 3, onLocked, animated = true, labelMotion = 'roll', className }: AccordionProps) {
  const still = useStill(animated)
  const baseId = useId()
  const root = useRef<HTMLDivElement>(null)
  const [held, setHeld] = useState(defaultValue)
  const current = value ?? held

  function set(next: string[]): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function toggle(item: string): void {
    if (current.includes(item)) set(current.filter((open) => open !== item))
    else set(type === 'single' ? [item] : [...current, item])
  }

  function hoverOpen(item: string): void {
    if (!current.includes(item)) set(type === 'single' ? [item] : [...current, item])
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    const triggers = [...(root.current?.querySelectorAll<HTMLButtonElement>('[data-accordion-trigger]:not([data-disabled])') ?? [])]
    const at = triggers.indexOf(e.currentTarget)
    const targets: Record<string, number> = { ArrowDown: (at + 1) % triggers.length, ArrowUp: (at - 1 + triggers.length) % triggers.length, Home: 0, End: triggers.length - 1 }
    const target = targets[e.key]
    if (target === undefined) return
    e.preventDefault()
    triggers[target]?.focus()
  }

  return (
    <div ref={root} className={cx(styles.accordion, className)} data-style={styleKind} data-still={still ? '' : undefined} data-off={animated ? undefined : ''}>
      {header ? (
        <div className={styles.header}>
          <span className={styles.headerTitle}>{header.title}</span>
          {header.meta ? <span className={styles.meta}>{header.meta}</span> : null}
        </div>
      ) : null}
      {items.map((item) => (
        <Row
          key={item.value}
          item={item}
          styleKind={styleKind}
          labelMotion={labelMotion}
          open={!item.locked && current.includes(item.value)}
          headingLevel={headingLevel}
          baseId={baseId}
          still={still}
          onToggle={() => toggle(item.value)}
          onHoverOpen={() => hoverOpen(item.value)}
          onLocked={() => onLocked?.(item.value)}
          onKeyDown={onKeyDown}
        />
      ))}
    </div>
  )
}
