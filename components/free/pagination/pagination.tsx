'use client'
import { motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { ChevronLeftIcon } from '@fetaui/react/rounded/chevron-left'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { ease, duration, spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { Input } from '../input/input'
import { FlowNumber } from '../motion-kit/flow-number'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Select } from '../select/select'
import styles from './pagination.module.css'

/** Pages shown around the current one in Numbered and Jump. */
const SIBLINGS = 1

/** The first, the last, and the current with its neighbours. `null` is an ellipsis. */
export function pageRange(page: number, pages: number, siblings = SIBLINGS): (number | null)[] {
  const wanted = [...new Set([1, pages, ...Array.from({ length: siblings * 2 + 1 }, (_, i) => page - siblings + i)])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b)
  return wanted.flatMap((n, i) => {
    const before = wanted[i - 1]
    if (before === undefined || n - before === 1) return [n]
    return n - before === 2 ? [before + 1, n] : [null, n]
  })
}

export type PageItemProps = {
  page: number
  active?: boolean
  disabled?: boolean
  still?: boolean
  /** Shared by the items of one tray, so the active pill slides between them. */
  group?: string
  onSelect?: (page: number) => void
}

/** One page in the tray. The pill lives on its own layer, so the numbers never move. */
export function PageItem({ page, active = false, disabled = false, still: stillProp = false, group, onSelect }: PageItemProps) {
  // Standalone items still follow reduced motion and a parent `animated={false}`.
  const still = useStill(!stillProp)
  const fallback = useId()
  return (
    <button
      type="button"
      className={styles.item}
      aria-label={`Page ${page}`}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      data-still={still ? '' : undefined}
      onClick={() => onSelect?.(page)}
    >
      {active ? <motion.span {...(still ? {} : { layoutId: `${group ?? fallback}-pill` })} className={styles.pill} style={{ borderRadius: 10 }} transition={spring.slide} /> : null}
      <span className={styles.number} aria-hidden="true"><FlowNumber value={page} still={still || disabled} /></span>
    </button>
  )
}

export type PaginationProps = {
  /** Default `numbered`. */
  kind?: 'simple' | 'numbered' | 'compact' | 'table' | 'jump' | 'load-more' | 'dots'
  /** Number of pages. For `dots`, the number of slides. */
  pages?: number
  page?: number
  defaultPage?: number
  onPageChange?: (page: number) => void
  /** `table`: rows on one page. */
  perPage?: number
  perPageOptions?: number[]
  onPerPageChange?: (perPage: number) => void
  /** `table` and `load-more`: rows in all. */
  total?: number
  /** `load-more`: rows showing now. */
  shown?: number
  /** `load-more`: rows one press adds. */
  step?: number
  onLoadMore?: () => void
  'aria-label'?: string
  animated?: boolean
  className?: string
}

/** Ways to move through pages. The current page lifts onto surface and slides to where you clicked. */
export function Pagination({ kind = 'numbered', pages = 12, page, defaultPage = 1, onPageChange, perPage = 25, perPageOptions = [10, 25, 50, 100], onPerPageChange, total: totalProp, shown = 0, step = 20, onLoadMore, 'aria-label': label = 'Pagination', animated = true, className }: PaginationProps) {
  const still = useStill(animated)
  const uid = useId()
  const [held, setHeld] = useState(defaultPage)
  const [heldPer, setHeldPer] = useState(perPage)
  const [seen, setSeen] = useState(defaultPage)
  /** The gap whose inline field is open, as `tray:index`: Numbered renders a Web and a Mobile tray. */
  const [jumping, setJumping] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLElement>(null)
  const pressed = useRef<Element | null>(null)
  const gapBack = useRef<string | null>(null)
  const total = totalProp ?? 0
  const current = page ?? held
  // `table` with a total pages by rows. Without one it falls back to `pages`.
  const last = kind === 'table' && totalProp !== undefined ? Math.max(1, Math.ceil(total / heldPer)) : pages

  useEffect(() => { setSeen((most) => Math.max(most, current)) }, [current])
  useEffect(() => { setHeldPer(perPage) }, [perPage])
  // An arrow that turns disabled drops focus, so it passes to the one that still works.
  useEffect(() => {
    if (pressed.current?.matches(':disabled')) [...(root.current?.querySelectorAll<HTMLElement>('[data-arrow]:not(:disabled)') ?? [])].find((node) => node.offsetParent !== null)?.focus()
    pressed.current = null
  }, [current])
  useEffect(() => {
    if (jumping !== null) { field.current?.focus(); return }
    // Esc closes the inline field, so focus goes back to the gap it came from.
    if (gapBack.current !== null) root.current?.querySelector<HTMLElement>(`[data-gap="${gapBack.current}"]`)?.focus()
    gapBack.current = null
  }, [jumping])

  function go(next: number): void {
    pressed.current = document.activeElement
    const target = Math.max(1, Math.min(last, next))
    setHeld(target)
    onPageChange?.(target)
  }

  function changePer(next: number): void {
    setHeldPer(next)
    onPerPageChange?.(next)
    if (total > 0 && current > Math.ceil(total / next)) go(Math.ceil(total / next))
  }

  function submit(e: FormEvent): void {
    e.preventDefault()
    const target = Number.parseInt(typed, 10)
    if (Number.isFinite(target)) go(target)
    setTyped('')
    setJumping(null)
  }

  const prev = <ChevronLeftIcon />
  const next = <ChevronRightIcon />
  const arrow = (direction: -1 | 1, variant: 'ghost' | 'secondary' = 'ghost', size: 'sm' | 'md' = 'sm'): ReactNode => (
    <IconButton variant={variant} size={size} animated={animated} label={direction < 0 ? 'Previous page' : 'Next page'} icon={direction < 0 ? prev : next} data-arrow="" disabled={direction < 0 ? current <= 1 : current >= last} onClick={() => go(current + direction)} />
  )
  /** Web arrows at 28, Mobile arrows as 44 secondary circles (Figma Mobile Compact, Table and Numbered). */
  const arrows = (direction: -1 | 1, variant: 'ghost' | 'secondary'): ReactNode => (
    <>
      <span className={styles.wide}>{arrow(direction, variant)}</span>
      <span className={styles.narrow}>{arrow(direction, 'secondary', 'md')}</span>
    </>
  )
  const tray = (list: (number | null)[], name = 'pages'): ReactNode => (
    <div className={styles.tray}>
      {list.map((entry, i) => (entry === null ? (
        jumping === `${name}:${i}` ? (
          <form key={`jump-${i}`} className={styles.inlineJump} onSubmit={submit}>
            <motion.span initial={still ? false : { opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: still ? 0 : duration.base, ease: ease.out }}>
              <Input ref={field} size="sm" inputMode="numeric" aria-label="Go to page" className={styles.jumpInput} value={typed} onChange={(e) => setTyped(e.target.value)} onBlur={() => { setTyped(''); setJumping(null) }} onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); gapBack.current = `${name}:${i}`; setTyped(''); setJumping(null) } }} animated={animated} />
            </motion.span>
          </form>
        ) : (
          <button key={`gap-${i}`} type="button" className={styles.item} data-gap={`${name}:${i}`} aria-label="Jump to a page" onClick={() => setJumping(`${name}:${i}`)}>
            <span className={styles.number}><MoreHorizontalIcon /></span>
          </button>
        )
      ) : <PageItem key={`${name}-slot-${i}`} page={entry} active={entry === current} still={still} group={`${uid}-${name}`} onSelect={go} />))}
    </div>
  )

  const body = (): ReactNode => {
    switch (kind) {
      case 'simple':
        return tray(Array.from({ length: pages }, (_, i) => i + 1))
      case 'compact':
        return (
          <div className={styles.row}>
            {arrows(-1, 'ghost')}
            <span className={styles.status}>Page <strong><FlowNumber value={current} still={still} /></strong> of <FlowNumber value={pages} still={still} /></span>
            {arrows(1, 'ghost')}
          </div>
        )
      case 'table': {
        const from = total > 0 ? (current - 1) * heldPer + 1 : 0
        const to = Math.min(current * heldPer, total)
        return (
          <div className={styles.row} data-spread="">
            <span className={styles.perPage}>
              <span className={styles.caption}>Rows per page</span>
              <Select kind="pill" className={cx(styles.perSelect)} aria-label="Rows per page" animated={animated} value={String(heldPer)} onValueChange={(v) => changePer(Number(v))} options={perPageOptions.map((n) => ({ value: String(n), label: String(n) }))} />
            </span>
            <span className={styles.range}>{totalProp === undefined ? <>Page <FlowNumber value={current} still={still} /> of <FlowNumber value={last} still={still} /></> : <><FlowNumber value={from} still={still} /> to <FlowNumber value={to} still={still} /> of <FlowNumber value={total} still={still} /></>}</span>
            <span className={styles.pager}>{arrows(-1, 'secondary')}{arrows(1, 'secondary')}</span>
          </div>
        )
      }
      case 'jump':
        return (
          <div className={styles.row}>
            {tray(pageRange(current, pages, 0))}
            <form className={styles.row} onSubmit={submit}>
              <span className={styles.caption}>Go to</span>
              <Input size="sm" inputMode="numeric" aria-label="Go to page" className={styles.jumpInput} value={typed} onChange={(e) => setTyped(e.target.value)} animated={animated} />
              <Button type="submit" variant="secondary" size="sm" animated={animated}>Go</Button>
            </form>
          </div>
        )
      case 'load-more':
        return (
          <div className={styles.load}>
            <span className={styles.status}>Showing <strong><FlowNumber value={shown} still={still} /></strong> of <FlowNumber value={total} still={still} /></span>
            <span className={styles.track} role="progressbar" aria-label="Loaded" aria-valuemin={0} aria-valuemax={total} aria-valuenow={shown}>
              <motion.span className={styles.fill} initial={false} animate={{ scaleX: total ? shown / total : 0 }} transition={{ duration: still ? 0 : LOAD_S, ease: ease.out }} />
            </span>
            {shown < total ? <Button variant="secondary" size="sm" animated={animated} onClick={onLoadMore}>{`Load ${Math.min(step, total - shown)} more`}</Button> : null}
          </div>
        )
      case 'dots':
        return (
          <div className={styles.dots} style={{ '--count': pages } as CSSProperties}>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={styles.dotButton}
                aria-label={`Go to slide ${n}`}
                aria-current={n === current ? 'true' : undefined}
                data-state={n === current ? 'on' : n <= seen ? 'seen' : undefined}
                data-after={n > current ? '' : undefined}
                data-still={still ? '' : undefined}
                style={{ '--index': n - 1 } as CSSProperties}
                onClick={() => go(n)}
              >
                <span className={styles.dot} />
              </button>
            ))}
          </div>
        )
      default:
        return (
          <div className={styles.row}>
            <span className={styles.wide}><Button variant="ghost" size="sm" animated={animated} leadingIcon={prev} data-arrow="" disabled={current <= 1} onClick={() => go(current - 1)}>Previous</Button></span>
            <span className={styles.narrow}>{arrow(-1, 'secondary', 'md')}</span>
            {/* Mobile drops the neighbours: first, current and last between the arrows (Figma Numbered Mobile). */}
            <span className={styles.wide}>{tray(pageRange(current, pages))}</span>
            <span className={styles.narrow}>{tray(pageRange(current, pages, 0), 'mobile')}</span>
            <span className={styles.wide}><Button variant="ghost" size="sm" animated={animated} trailingIcon={next} data-arrow="" disabled={current >= pages} onClick={() => go(current + 1)}>Next</Button></span>
            <span className={styles.narrow}>{arrow(1, 'secondary', 'md')}</span>
          </div>
        )
    }
  }

  return <nav ref={root} aria-label={label} className={cx(styles.pagination, className)} data-kind={kind} data-still={still ? '' : undefined}>{body()}</nav>
}

/** Figma 41: the Load more track fills in 240 ms. */
const LOAD_S = 0.24
