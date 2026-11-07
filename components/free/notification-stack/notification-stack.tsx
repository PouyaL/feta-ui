'use client'
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TrashIcon } from '@fetaui/react/rounded/trash'
import { XIcon } from '@fetaui/react/rounded/x'
import { ease, spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './notification-stack.module.css'

const STEP = 66
const CARD = 62
const FANNED = 82
const FAN_OFFSET = 10
/** Web widths of the two cards behind: 360 and 344 of 376. */
const FAN_SCALE = [1, 0.957, 0.915]
/** Expand stack: 300 ms, spring 0.25. */
const FAN_MS = 300
const FAN_SPRING = { type: 'spring', duration: FAN_MS / 1000, bounce: 0.25 } as const
/** New notification: 240 ms, y from 12 px above. */
const ARRIVE = 0.24
const ARRIVE_SHIFT = 12
/** Dismiss past 40% of the width or at 500 px/s. */
const DISMISS_SHARE = 0.4
const DISMISS_VELOCITY = 500
/** The Swiping frame: the card sits 98 px across at 55%. */
const SWIPE_FRAME = 98
const SWIPE_OPACITY = 0.55

export type NotificationItem = {
  id: string
  title: string
  body: ReactNode
  /** Short text like `now` or `9:50`. */
  time: string
  /** Colour of the solid icon tile. Default `inverse`. */
  tone?: 'success' | 'danger' | 'info' | 'inverse'
  icon: ReactNode
}

export type NotificationStackProps = {
  items: NotificationItem[]
  /** Default `Notifications`. */
  title?: string
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (expanded: boolean) => void
  /** Items leave the stack on their own. Use this to remove them from your data. */
  onDismiss?: (id: string) => void
  /** Holds the top card at the Swiping pose, for documentation. */
  swipePreview?: boolean
  /** `false` turns off the fan, the fling and swiping. Dismiss stays on the corner button. */
  animated?: boolean
  className?: string
}

function Notice({ item, index, open, count, still, swipePreview, onDismiss }: {
  item: NotificationItem
  index: number
  open: boolean
  count: number
  still: boolean
  swipePreview: boolean
  onDismiss: (id: string) => void
}) {
  const x = useMotionValue(swipePreview ? SWIPE_FRAME : 0)
  const noticeOpacity = useTransform(x, [0, SWIPE_FRAME], [1, SWIPE_OPACITY])
  const stripOpacity = useTransform(x, [0, 24], [0, 1])
  const reachable = open || index === 0
  const fan = Math.min(index, FAN_SCALE.length - 1)

  function release(event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo): void {
    const width = (event.target as HTMLElement).closest('li')?.offsetWidth ?? 376
    if (info.offset.x > width * DISMISS_SHARE || info.velocity.x > DISMISS_VELOCITY) {
      void animate(x, width * 1.1, { duration: 0.18, ease: ease.out }).then(() => onDismiss(item.id))
    } else {
      void animate(x, 0, spring.settle)
    }
  }

  return (
    <motion.li
      className={styles.item}
      style={{ zIndex: count - index }}
      data-id={item.id}
      data-reachable={reachable ? '' : undefined}
      initial={still ? false : { y: (open ? index * STEP : 0) - ARRIVE_SHIFT, opacity: 0 }}
      animate={{ y: open ? index * STEP : fan * FAN_OFFSET, scaleX: open ? 1 : FAN_SCALE[fan] ?? 1, opacity: open || index <= 2 ? 1 : 0 }}
      exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: ARRIVE, ease: ease.out } }}
      transition={still ? { duration: 0 } : FAN_SPRING}
      aria-hidden={reachable ? undefined : true}
      inert={reachable ? undefined : true}
    >
      <motion.div className={styles.strip} style={{ opacity: stripOpacity }} aria-hidden="true">
        <TrashIcon size={16} />
        <span>Dismiss</span>
      </motion.div>
      <motion.div
        className={styles.notice}
        style={{ x, opacity: noticeOpacity }}
        drag={!still && reachable ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragEnd={release}
      >
        <div className={styles.content} data-blank={reachable ? undefined : ''}>
          <span className={styles.tile} data-tone={item.tone ?? 'inverse'}>{item.icon}</span>
          <div className={styles.text}>
            <div className={styles.top}>
              <span className={styles.title}>{item.title}</span>
              <span className={styles.time}>{item.time}</span>
            </div>
            <p className={styles.body}>{item.body}</p>
          </div>
        </div>
        {reachable ? (
          <IconButton data-chip="" className={styles.chip} variant="secondary" size="sm" icon={<XIcon size={12} />} label={`Dismiss ${item.title}`} animated={!still} onClick={() => onDismiss(item.id)} />
        ) : null}
      </motion.div>
    </motion.li>
  )
}

/** Notifications as inset cards on the tray. They fan when collapsed, list when expanded, and swipe away. */
export function NotificationStack({ items, title = 'Notifications', expanded, defaultExpanded = false, onExpandedChange, onDismiss, swipePreview = false, animated = true, className }: NotificationStackProps) {
  const still = useStill(animated)
  const root = useRef<HTMLElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const [held, setHeld] = useState(defaultExpanded)
  const [gone, setGone] = useState<string[]>([])
  const open = expanded ?? held
  // The list keeps its height until the cards have folded back, and only the tray fill moves.
  const [tall, setTall] = useState(open)
  useEffect(() => {
    if (open || still) { setTall(open); return }
    const timer = setTimeout(() => setTall(false), FAN_MS)
    return () => clearTimeout(timer)
  }, [open, still])

  const shown = items.filter(({ id }) => !gone.includes(id))
  const empty = shown.length === 0
  const list = Math.max(shown.length * STEP - (STEP - CARD), CARD)
  const area = open || tall ? list : FANNED
  const fill = Math.max(list, FANNED)
  const clip = fill - (open ? list : FANNED)

  function toggle(): void {
    setHeld(!open)
    onExpandedChange?.(!open)
  }

  function dismiss(id: string): void {
    setGone((current) => [...current, id])
    onDismiss?.(id)
    // Focus stays in the stack: on the next item, then the toggle, then the heading when nothing is left.
    requestAnimationFrame(() => {
      const next = root.current?.querySelector<HTMLElement>(`li[data-reachable]:not([data-id="${CSS.escape(id)}"]) [data-chip]`)
      const target = next ?? root.current?.querySelector<HTMLElement>('[data-toggle]') ?? heading.current
      target?.focus()
    })
  }

  return (
    <section ref={root} className={cx(styles.stack, className)} aria-label={title} data-empty={empty ? '' : undefined} data-still={still ? '' : undefined} data-open={open ? '' : undefined}>
      {empty ? null : <span className={styles.fill} style={{ height: `calc(100% + ${fill - area}px)`, clipPath: `inset(0 0 ${clip}px 0 round var(--feta-radius-tray))` }} aria-hidden="true" />}
      <div className={styles.header}>
        <h3 ref={heading} tabIndex={-1} className={styles.heading}>{title}<span className={styles.count}>{shown.length}</span></h3>
        {empty ? null : <Button data-toggle="" variant="ghost" size="sm" animated={animated} aria-expanded={open} onClick={toggle}>{open ? 'Show less' : 'Show all'}</Button>}
      </div>
      {empty ? (
        <p className={styles.empty}>You’re all caught up.</p>
      ) : (
        <ul className={styles.list} style={{ height: area }} aria-live="polite" aria-relevant="additions" aria-label={`${shown.length} notifications`}>
          <AnimatePresence initial={false}>
            {shown.map((item, index) => <Notice key={item.id} item={item} index={index} open={open} count={shown.length} still={still} swipePreview={swipePreview && index === 0} onDismiss={dismiss} />)}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}
