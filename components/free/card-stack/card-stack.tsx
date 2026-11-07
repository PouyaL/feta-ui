'use client'
import { animate, motion, useDragControls, useMotionValue, useMotionValueEvent, useTransform, type PanInfo } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeftIcon } from '@fetaui/react/rounded/arrow-left'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { ShoppingCartIcon } from '@fetaui/react/rounded/shopping-cart'
import { XIcon } from '@fetaui/react/rounded/x'
import { Button } from '../button/button'
import { Card } from '../card/card'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './card-stack.module.css'

/** Stack release: 350 ms. Details: 350 ms, spring 0.25. */
const FLING_SPRING = { type: 'spring', duration: 0.35, bounce: 0 } as const
const BACK_SPRING = { type: 'spring', duration: 0.35, bounce: 0.25 } as const
const DETAILS_SPRING = { type: 'spring', duration: 0.35, bounce: 0.25 } as const
/** Skip past 30% of the card width, or at this velocity. */
const SKIP_SHARE = 0.3
const SKIP_VELOCITY = 500
/** Rotate is x / 20. */
const TILT = 20
/** The posed card sits 70 px over, as `.print[data-held]` draws it; a grab picks it up from there. */
const POSE_X = 70
/** The Rest print is 232 wide, the Details print 300. */
const DETAILS_FROM = 232 / 300
/** Cards shown in the fan. */
const FAN = 4

export type PrintItem = {
  name: string
  meta: string
  price: string
  art: ReactNode
  description?: string
  specs?: [string, string][]
}

export type StackState = 'rest' | 'dragging' | 'details'

export type CardStackProps = {
  items?: PrintItem[]
  /** Controls which print is on top. */
  index?: number
  defaultIndex?: number
  onIndexChange?: (index: number) => void
  /** `dragging` holds the pose, for a preview. Leave it out to keep the state here. */
  state?: StackState
  defaultState?: StackState
  onStateChange?: (state: StackState) => void
  onAdd?: (item: PrintItem) => void
  /** `false` drops the fling and fan: the arrows swap prints in place. */
  animated?: boolean
  className?: string
}

const Paper = ({ children }: { children: ReactNode }) => <svg viewBox="0 0 216 216" className={styles.artSvg} aria-hidden="true">{children}</svg>

/** Line art in avatar paper and ink. Replace it with images through `items`. */
const ART = {
  sun: <Paper><circle cx="107" cy="97" r="49" fill="currentColor" />{[86, 76, 65, 54, 43, 32].map((w, i) => <rect key={w} x={108 - w / 2} y={134 + i * 8} width={w} height="3" fill="currentColor" />)}</Paper>,
  ridge: <Paper><circle cx="150" cy="46" r="13" fill="currentColor" /><ellipse cx="83" cy="207" rx="145" ry="93" fill="currentColor" /><ellipse cx="165" cy="218" rx="124" ry="73" fill="currentColor" opacity="0.6" /></Paper>,
  pools: <Paper>{[89, 77, 64, 51, 38, 25, 13].map((r, i) => <circle key={r} cx="108" cy="108" r={r * 1.09} fill={i % 2 ? 'var(--feta-avatar-bg)' : 'currentColor'} />)}</Paper>,
  stalls: <Paper>{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <rect key={i} x={32 + (i % 3) * 53} y={32 + Math.floor(i / 3) * 53} width="44" height="44" rx="4" fill="currentColor" opacity={i % 2 ? 1 : 0.6} />)}</Paper>,
  flats: <Paper>{[0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={i} x="28" y={40 + i * 22} width="160" height={4 + i * 2} rx="2" fill="currentColor" opacity={0.4 + i * 0.1} />)}</Paper>,
}

const PRINTS: PrintItem[] = [
  { name: 'Low Sun', meta: 'Print 01 · Risograph', price: '$48', art: ART.sun, description: 'The last ten minutes of light over the bay, pulled in two inks.', specs: [['Size', 'A3'], ['Paper', 'Cream 120g'], ['Edition', 'of 50']] },
  { name: 'Ridge Line', meta: 'Print 02 · Screen print', price: '$72', art: ART.ridge, description: 'Two ridges at dusk, screened by hand on heavy stock.', specs: [['Size', 'A2'], ['Paper', 'Natural 200g'], ['Edition', 'of 30']] },
  { name: 'Tide Pools', meta: 'Print 03 · Risograph', price: '$40', art: ART.pools, description: 'Rings of water at low tide, in one ink and the paper.', specs: [['Size', 'A4'], ['Paper', 'Cream 120g'], ['Edition', 'of 80']] },
  { name: 'Night Market', meta: 'Print 04 · Giclée', price: '$56', art: ART.stalls, description: 'Nine stalls seen from above just before they close.', specs: [['Size', 'A3'], ['Paper', 'Cotton 310g'], ['Edition', 'of 40']] },
  { name: 'Salt Flats', meta: 'Print 05 · Risograph', price: '$44', art: ART.flats, description: 'Bands of white crust running out to the horizon.', specs: [['Size', 'A3'], ['Paper', 'Cream 120g'], ['Edition', 'of 60']] },
]

const pad = (value: number): string => String(value).padStart(2, '0')

function Caption({ item }: { item: PrintItem }) {
  return (
    <span className={styles.caption}>
      <span className={styles.captionText}><span className={styles.name}>{item.name}</span><span className={styles.meta}>{item.meta}</span></span>
      <span className={styles.name}>{item.price}</span>
    </span>
  )
}

/** A fanned stack of prints. Drag the top card to skip, or open it for specs and Add to cart. */
export function CardStack({ items = PRINTS, index, defaultIndex = 0, onIndexChange, state, defaultState = 'rest', onStateChange, onAdd, animated = true, className }: CardStackProps) {
  const still = useStill(animated)
  const count = items.length
  const [ownIndex, setOwnIndex] = useState(defaultIndex)
  const [ownState, setOwnState] = useState<StackState>(defaultState)
  const [armed, setArmed] = useState(false)
  const current = index ?? ownIndex
  const shown = state ?? ownState
  // `dragging` poses the top card mid-drag. Grabbing it hands the pose to a real drag, from where the pose left it.
  const [released, setReleased] = useState(false)
  useEffect(() => { setReleased(false) }, [shown])
  const held = shown === 'dragging' && !released
  const controls = useDragControls()
  const details = shown === 'details'
  const top = items[current]

  const stage = useRef<HTMLDivElement>(null)
  const topCard = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const hint = useRef<HTMLSpanElement>(null)
  const dragged = useRef(false)
  const busy = useRef(false)
  const arrival = useRef<'skip' | 'back' | null>(null)
  const x = useMotionValue(0)
  const rotate = useTransform(x, (value) => value / TILT)
  const width = (): number => topCard.current?.offsetWidth ?? 232
  const away = (): number => (stage.current?.offsetWidth ?? 440) * 0.9
  const opacity = useTransform(x, (value) => 1 - Math.max(0, (Math.abs(value) - away() * 0.6) / (away() * 0.4)))

  // Written straight to the stage, so a drag never re-renders per frame.
  useMotionValueEvent(x, 'change', (value) => {
    const lift = Math.min(1, Math.abs(value) / (width() * SKIP_SHARE))
    stage.current?.style.setProperty('--lift', String(lift))
    if (hint.current) hint.current.style.opacity = String(busy.current ? 0 : lift)
    if (hint.current) hint.current.style.transform = `translateX(calc(-50% + ${value}px))`
    if (!busy.current) setArmed(lift >= 1)
  })

  const commit = (next: number): void => {
    const wrapped = (next + count) % count
    setOwnIndex(wrapped)
    onIndexChange?.(wrapped)
  }

  function skip(direction: 1 | -1, velocity = 0): void {
    if (busy.current || count < 2) return
    if (still) { commit(current + direction); return }
    busy.current = true
    setArmed(false)
    if (direction > 0) {
      const sign = x.get() < 0 ? -1 : 1
      void animate(x, sign * away(), { ...FLING_SPRING, velocity, onComplete: () => { arrival.current = 'skip'; commit(current + 1) } })
    } else {
      arrival.current = 'back'
      commit(current - 1)
    }
  }

  // Runs before paint on the new top print, so the swap never flashes.
  useLayoutEffect(() => {
    const kind = arrival.current
    arrival.current = null
    if (kind === 'skip') { x.jump(0); stage.current?.style.setProperty('--lift', '0'); busy.current = false; dragged.current = false }
    if (kind === 'back') {
      x.jump(-away())
      stage.current?.style.setProperty('--lift', '1')
      void animate(x, 0, { ...BACK_SPRING, onComplete: () => { busy.current = false } })
    }
  }, [current, x])

  function onDragEnd(_: unknown, info: PanInfo): void {
    if (Math.abs(info.offset.x) > width() * SKIP_SHARE || Math.abs(info.velocity.x) > SKIP_VELOCITY) skip(1, info.velocity.x)
    else void animate(x, 0, BACK_SPRING)
  }

  function setState(next: StackState): void {
    setOwnState(next)
    onStateChange?.(next)
  }

  function close(): void {
    setState('rest')
    requestAnimationFrame(() => topCard.current?.focus())
  }

  // On the whole card, because Close sits on the tray outside the scene.
  function onEscape(event: KeyboardEvent<HTMLElement>): void {
    if (event.key === 'Escape' && details) { event.preventDefault(); close() }
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'ArrowRight') { event.preventDefault(); skip(1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); skip(-1) }
  }

  // Only on the change, so a stack that starts open does not take focus when the page loads.
  const wasDetails = useRef(details)
  useEffect(() => {
    if (details && !wasDetails.current && ownState === 'details') closeButton.current?.focus()
    wasDetails.current = details
  }, [details, ownState])

  const number = armed || held ? ((current + 1) % count) + 1 : current + 1
  const visible = Array.from({ length: Math.min(FAN, count) }, (_, depth) => ({ depth, item: items[(current + depth) % count] }))

  return (
    <Card
      onKeyDown={onEscape}
      className={cx(styles.stack, className)}
      bodyClassName={styles.stage}
      footerClassName={styles.controls}
      aria-label="Prints"
      animated={animated}
      footer={
        <>
          <IconButton size="sm" variant="secondary" icon={<ArrowLeftIcon />} label="Previous print" animated={animated} onClick={() => skip(-1)} />
          <span className={styles.counter} aria-live="polite"><span className={styles.srOnly}>Print </span>{pad(number)} / {pad(count)}</span>
          {details
            ? <IconButton ref={closeButton} size="sm" variant="secondary" icon={<XIcon />} label="Close details" animated={animated} onClick={close} />
            : <IconButton size="sm" variant="secondary" icon={<ArrowRightIcon />} label="Next print" animated={animated} onClick={() => skip(1)} />}
        </>
      }
    >
      <div ref={stage} className={styles.scene} data-details={details ? '' : undefined} onKeyDown={onKey}>
        {details && top ? (
          <motion.div key={top.name} className={styles.detail} initial={still ? false : { scale: DETAILS_FROM, y: -16 }} animate={{ scale: 1, y: 0 }} transition={still ? { duration: 0 } : DETAILS_SPRING}>
            <span className={styles.art}>{top.art}</span>
            <Caption item={top} />
            <div className={styles.more}>
              {top.description ? <p className={styles.description}>{top.description}</p> : null}
              {top.specs ? <dl className={styles.specs}>{top.specs.map(([label, value]) => <div key={label} className={styles.spec}><dt className={styles.meta}>{label}</dt><dd className={styles.specValue}>{value}</dd></div>)}</dl> : null}
              <Button className={styles.add} leadingIcon={<ShoppingCartIcon />} feedback={{ success: 'Added to cart' }} animated={animated} onClick={() => onAdd?.(top)}>Add to cart · {top.price}</Button>
            </div>
          </motion.div>
        ) : (
          <>
            {visible.slice().reverse().map(({ depth, item }) => (item ? (
              depth === 0 ? (
                <motion.button
                  key={item.name}
                  ref={topCard}
                  type="button"
                  className={styles.print}
                  data-depth="0"
                  data-held={held ? '' : undefined}
                  aria-label={`${item.name}, ${item.meta}, ${item.price}. Open details`}
                  drag={still ? false : 'x'}
                  dragControls={controls}
                  dragListener={!held}
                  dragMomentum={false}
                  dragElastic={1}
                  style={held ? {} : { x, rotate, opacity }}
                  onPointerDown={(e) => {
                    dragged.current = false
                    if (!held) return
                    x.jump(POSE_X)
                    setReleased(true)
                    controls.start(e)
                  }}
                  onDragStart={() => { dragged.current = true }}
                  onDragEnd={onDragEnd}
                  onClick={() => { if (dragged.current) dragged.current = false; else setState('details') }}
                >
                  <span className={styles.art}>{item.art}</span>
                  <Caption item={item} />
                </motion.button>
              ) : (
                <span key={item.name} className={styles.print} data-depth={depth} aria-hidden="true">
                  <span className={styles.art}>{item.art}</span>
                  <Caption item={item} />
                </span>
              )
            ) : null))}
            <span ref={hint} className={styles.hint} data-held={held ? '' : undefined} aria-hidden="true"><ArrowRightIcon size={14} />Release to skip</span>
          </>
        )}
      </div>
    </Card>
  )
}
