'use client'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { BookOpenIcon } from '@fetaui/react/rounded/book-open'
import { ChevronLeftIcon } from '@fetaui/react/rounded/chevron-left'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { IconButton } from '../icon-button/icon-button'
import { Card } from '../card/card'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './page-flip.module.css'

/** Turn page: 700 ms in-out over the spine. */
const TURN = 0.7
const TURN_EASE = [0.65, 0, 0.35, 1] as const
/** Shade peak at 90 degrees, from the Turning frame. */
const SHADE_PEAK = 0.3
/** Single page books swing the leaf away instead of laying it on a left page. */
const SINGLE_ANGLE = -110
const SWIPE = 40
/** Below this width the book shows one page at a time. */
const SINGLE_WIDTH = 440

export type PageFlipProps = {
  /** The cover is page 1. */
  cover: ReactNode
  /** Pages after the cover, numbered from 2. */
  pages: ReactNode[]
  /** The page shown: 0 is the cover. On Web this picks the spread holding that page. */
  page?: number
  defaultPage?: number
  onPageChange?: (page: number) => void
  /** Holds a pose, for documentation. `peek` lifts the corner, and `turning` tilts the page over the spread. */
  pose?: 'peek' | 'turning'
  /** Default `Book`. */
  label?: string
  /** `false` turns pages at once. */
  animated?: boolean
  className?: string
}

type Turn = { from: number; to: number; forward: boolean }

/** A book you leaf through: spreads on Web, one page on Mobile. */
export function PageFlip({ cover, pages, page, defaultPage = 0, onPageChange, pose, label = 'Book', animated = true, className }: PageFlipProps) {
  const still = useStill(animated)
  const reduced = useReducedMotion()
  // The server cannot know the setting, so it applies after hydration.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  const fade = hydrated && Boolean(reduced) && animated
  const root = useRef<HTMLDivElement>(null)
  const [single, setSingle] = useState(false)
  const [held, setHeld] = useState(defaultPage)
  const [turn, setTurn] = useState<Turn | null>(null)
  const swipe = useRef<number | null>(null)
  const all = [cover, ...pages]
  const total = all.length

  useEffect(() => {
    const node = root.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setSingle((entry?.contentRect.width ?? SINGLE_WIDTH) < SINGLE_WIDTH))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const current = page ?? held
  // On Web a spread is an index: 0 is the cover, 1 is pages 2 and 3.
  const at = single ? current : Math.ceil(current / 2)
  const last = single ? total - 1 : Math.ceil((total - 1) / 2)
  const left = (spread: number): ReactNode => (single || spread === 0 ? null : all[spread * 2 - 1] ?? null)
  const right = (spread: number): ReactNode => (single ? all[spread] : all[spread * 2]) ?? null
  const counter = (spread: number): string => {
    if (single) return `${spread + 1} of ${total}`
    if (spread === 0) return `1 of ${total}`
    const first = spread * 2
    return first + 1 > total ? `${first} of ${total}` : `${first}–${first + 1} of ${total}`
  }
  const toPage = (spread: number): number => (single ? spread : Math.min(spread * 2, total - 1))

  function go(next: number): void {
    if (next < 0 || next > last || turn) return
    const commit = (): void => { setHeld(toPage(next)); onPageChange?.(toPage(next)) }
    if (still) { commit(); return }
    setTurn({ from: at, to: next, forward: next > at })
  }

  function finish(): void {
    if (!turn) return
    const target = toPage(turn.to)
    setHeld(target)
    onPageChange?.(target)
    setTurn(null)
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(at + 1) }
    if (event.key === 'ArrowLeft') { event.preventDefault(); go(at - 1) }
  }

  function swipeEnd(event: PointerEvent<HTMLDivElement>): void {
    if (swipe.current === null) return
    const moved = event.clientX - swipe.current
    swipe.current = null
    if (Math.abs(moved) > SWIPE) go(at + (moved < 0 ? 1 : -1))
  }

  // During a turn the spread under the leaf already shows what lands.
  const underLeft = turn ? left(turn.forward ? turn.from : turn.to) : left(at)
  const underRight = turn ? right(turn.forward ? turn.to : turn.from) : right(at)
  const leafFront = turn ? right(turn.forward ? turn.from : turn.to) : null
  const leafBack = turn ? left(turn.forward ? turn.to : turn.from) : null
  const flat = 0
  const laid = single ? SINGLE_ANGLE : -180
  const peeking = pose === 'peek' && !turn
  const coverShown = at === 0 && !turn

  return (
    <Card
      className={cx(styles.flip, className)}
      data-still={still ? '' : undefined}
      bodyClassName={styles.body}
      footerClassName={styles.footer}
      aria-label={label}
      animated={animated}
      footer={
        <>
          <span className={styles.counter} aria-live="polite">{counter(turn ? turn.to : at)}</span>
          <div className={styles.nav}>
            <IconButton variant="secondary" size="sm" icon={<ChevronLeftIcon />} label="Previous page" disabled={at === 0} animated={animated} onClick={() => go(at - 1)} />
            <IconButton variant="secondary" size="sm" icon={<ChevronRightIcon />} label="Next page" disabled={at === last} animated={animated} onClick={() => go(at + 1)} />
          </div>
        </>
      }
    >
      <div
        ref={root}
        className={styles.spread}
        data-single={single ? '' : undefined}
        data-fade={fade ? '' : undefined}
        tabIndex={0}
        role="group"
        aria-label={`${label}, use the left and right arrow keys to turn the page`}
        onKeyDown={onKey}
        onPointerDown={(event) => { swipe.current = still ? null : event.clientX }}
        onPointerUp={swipeEnd}
        onPointerCancel={() => { swipe.current = null }}
      >
        <div className={styles.slot} data-side="left">{underLeft ? <div key={String(at)} className={styles.page}>{underLeft}</div> : null}</div>
        <div className={styles.slot} data-side="right">
          {underRight ? (
            <div key={String(at)} className={styles.page} data-quiet={pose === 'turning' ? '' : undefined} data-inverse={coverShown ? '' : undefined}>
              <div className={styles.quiet}>{underRight}</div>
              {pose === 'turning' ? <div className={styles.tilt} aria-hidden="true">{underRight}<span className={styles.tiltShade} /></div> : null}
              {!turn && at !== last ? (
                <button type="button" className={styles.corner} data-peek={peeking ? '' : undefined} aria-label="Turn the page" tabIndex={-1} onClick={() => go(at + 1)}>
                  <span className={styles.fold} />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {turn ? (
          <motion.div
            key={`${turn.from}-${turn.to}`}
            className={styles.leaf}
            initial={{ rotateY: turn.forward ? flat : laid, opacity: 1 }}
            animate={{ rotateY: turn.forward ? laid : flat, opacity: single ? (turn.forward ? [1, 1, 0] : [0, 1, 1]) : 1 }}
            transition={{ duration: TURN, ease: TURN_EASE }}
            onAnimationComplete={finish}
            aria-hidden="true"
          >
            <div className={styles.face} data-inverse={(turn.forward ? turn.from : turn.to) === 0 ? '' : undefined}>
              {leafFront}
              <motion.span className={styles.shade} initial={{ opacity: 0 }} animate={{ opacity: [0, SHADE_PEAK, 0] }} transition={{ duration: TURN, ease: 'linear' }} />
            </div>
            {single ? null : <div className={styles.face} data-back="">{leafBack}<motion.span className={styles.shade} initial={{ opacity: 0 }} animate={{ opacity: [0, SHADE_PEAK, 0] }} transition={{ duration: TURN, ease: 'linear' }} /></div>}
          </motion.div>
        ) : null}
      </div>
    </Card>
  )
}

export type BookCoverProps = { kicker?: ReactNode; title: ReactNode; hint?: ReactNode }

/** The inverse cover. */
export function BookCover({ kicker, title, hint = 'Turn the corner' }: BookCoverProps) {
  return (
    <div className={styles.cover}>
      {kicker ? <p className={styles.coverKicker}>{kicker}</p> : null}
      <h3 className={styles.coverTitle}>{title}</h3>
      <p className={styles.coverFoot}><BookOpenIcon size={14} />{hint}</p>
    </div>
  )
}

export type BookPageProps = {
  kicker?: ReactNode
  heading?: ReactNode
  /** Page number at the foot. */
  folio?: number
  /** Which side the folio sits on. Default `end`. */
  folioSide?: 'start' | 'end'
  children?: ReactNode
}

/** One inset page: kicker, optional heading, content and a folio. */
export function BookPage({ kicker, heading, folio, folioSide = 'end', children }: BookPageProps) {
  return (
    <section className={styles.sheet} aria-label={folio ? `Page ${folio}` : undefined}>
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      {heading ? <h3 className={styles.heading}>{heading}</h3> : null}
      {children}
      {folio ? <p className={styles.folio} data-side={folioSide}>{folio}</p> : null}
    </section>
  )
}

/** A menu line: name, price leader, price and a note. */
export function BookDish({ name, price, note }: { name: ReactNode; price: ReactNode; note?: ReactNode }) {
  return (
    <div className={styles.dish}>
      <p className={styles.dishRow}><span>{name}</span><span className={styles.leader} /><span className={styles.price}>{price}</span></p>
      {note ? <p className={styles.note}>{note}</p> : null}
    </div>
  )
}

/** A label and value row. */
export function BookRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <p className={styles.row}><span>{label}</span><strong>{value}</strong></p>
}

/** Body copy for a page. */
export const BookText = ({ children }: { children: ReactNode }) => <p className={styles.text}>{children}</p>
