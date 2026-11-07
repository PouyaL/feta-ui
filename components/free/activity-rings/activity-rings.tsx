'use client'
import { AnimatePresence, motion, useInView } from 'motion/react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { ActivityIcon } from '@fetaui/react/rounded/activity'
import { FlameIcon } from '@fetaui/react/rounded/flame'
import { FootprintsIcon } from '@fetaui/react/rounded/footprints'
import { ease, spring } from '../../motion-tokens'
import { Badge } from '../badge/badge'
import { Card } from '../card/card'
import { cx, useStill } from '../motion-kit/motion-kit'
import { CountUp } from '../card-kit/card-kit'
import styles from './activity-rings.module.css'

/** Rings load: 800 ms sweep, 80 ms stagger per ring, then the lap past 100%. */
const SWEEP_DURATION = 0.8
const SWEEP_STAGGER = 0.08
const LAP_DURATION = 0.6

/** Outer radius of each ring in the 168 px box, with a 16 px stroke. */
const RADII = [76, 56, 36] as const

export type ActivityRing = {
  label: string
  value: number
  goal: number
  /** Shown after the goal, like `cal`. */
  unit: string
  /** Read out in the summary, like `calories`. Defaults to `unit`. */
  unitName?: string
  icon?: ReactNode
}

export type ActivityRingsProps = {
  /** Up to three rings, outer first. */
  rings?: ActivityRing[]
  title?: ReactNode
  date?: ReactNode
  /** The ring kept in focus. `null` for none. Leave it out to follow hover and focus. */
  active?: number | null
  defaultActive?: number | null
  onActiveChange?: (active: number | null) => void
  /** `false` shows final values with no sweep. */
  animated?: boolean
  className?: string
}

export const ACTIVITY_RINGS: ActivityRing[] = [
  { label: 'Move', value: 479, goal: 800, unit: 'cal', unitName: 'calories', icon: <FlameIcon size={14} /> },
  { label: 'Exercise', value: 42, goal: 30, unit: 'min', unitName: 'minutes', icon: <ActivityIcon size={14} /> },
  { label: 'Stand', value: 6, goal: 12, unit: 'hr', unitName: 'hours', icon: <FootprintsIcon size={14} /> },
]

const round = (value: number): string => String(Math.round(value))

function Arc({ radius, tone, share, delay, run, still, hidden }: { radius: number; tone: number; share: number; delay: number; run: boolean; still: boolean; hidden: boolean }) {
  const shown = run || still
  const first = Math.min(share, 1)
  const lap = Math.min(share - 1, 1)
  const shape = { cx: 84, cy: 84, r: radius }
  return (
    <>
      <circle {...shape} className={styles.track} />
      <g className={styles.ringGroup} data-tone={tone} data-hidden={hidden ? '' : undefined}>
        <motion.circle
          {...shape}
          className={styles.arc}
          initial={still ? false : { pathLength: 0 }}
          animate={{ pathLength: shown ? first : 0 }}
          transition={still ? { duration: 0 } : { duration: SWEEP_DURATION, delay, ease: ease.out }}
        />
        {lap > 0 && !still ? (
          <motion.circle
            {...shape}
            className={styles.arc}
            initial={{ pathLength: 0, opacity: 1 }}
            animate={shown ? { pathLength: lap, opacity: 0 } : { pathLength: 0, opacity: 1 }}
            transition={{ pathLength: { duration: LAP_DURATION, delay: delay + SWEEP_DURATION, ease: ease.out }, opacity: { duration: LAP_DURATION / 2, delay: delay + SWEEP_DURATION + LAP_DURATION, ease: ease.out } }}
          />
        ) : null}
      </g>
    </>
  )
}

/** Three goal rings in ink tones. Hover isolates one ring and its legend, and closing all three shows a success Badge. */
export function ActivityRings({ rings = ACTIVITY_RINGS, title = 'Activity', date = 'Thursday, Oct 29', active, defaultActive = null, onActiveChange, animated = true, className }: ActivityRingsProps) {
  const still = useStill(animated)
  const titleId = useId()
  const box = useRef<HTMLDivElement>(null)
  const inView = useInView(box, { once: true })
  const [pinned, setPinned] = useState(defaultActive)
  const [hovered, setHovered] = useState<number | null>(null)
  const controlled = active !== undefined
  const focus = controlled ? active : (hovered ?? pinned)
  // Only three rings draw, so only those count toward complete.
  const list = rings.slice(0, RADII.length)
  const complete = list.length > 0 && list.every((ring) => ring.value >= ring.goal)
  const focused = focus === null ? undefined : list[focus]

  function preview(index: number | null): void {
    setHovered(index)
    onActiveChange?.(index ?? pinned)
  }
  function pin(index: number): void {
    const next = pinned === index ? null : index
    setPinned(next)
    onActiveChange?.(next)
  }

  const summary = list.map((ring) => `${ring.label} ${ring.value} of ${ring.goal} ${ring.unitName ?? ring.unit}`).join(', ')
  const badge = focused ? `${focused.label} · ${Math.round((focused.value / focused.goal) * 100)}%` : complete ? 'All rings closed' : `${list.length} of ${list.length} tracked`

  return (
    <Card className={cx(styles.rings, className)} aria-labelledby={titleId} animated={animated}>
      <div className={styles.header}>
        <div>
          <h3 id={titleId} className={styles.title}>{title}</h3>
          <p className={styles.date}>{date}</p>
        </div>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={complete && !focused ? 'done' : 'count'} className={styles.badge} initial={still ? false : { scale: 0 }} animate={{ scale: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { scale: 0 }} transition={spring.stamp}>
            <Badge size="sm" tone={complete && !focused ? 'success' : 'neutral'} mark={complete && !focused} animated={animated}>{badge}</Badge>
          </motion.span>
        </AnimatePresence>
      </div>
      <div className={styles.row}>
        <div ref={box} className={styles.box}>
          <svg viewBox="0 0 168 168" className={styles.svg} role="img" aria-label={summary}>
            {list.map((ring, index) => (
              <g key={ring.label} onPointerEnter={() => preview(index)} onPointerLeave={() => preview(null)}>
                <Arc radius={RADII[index] ?? 36} tone={index} share={ring.value / ring.goal} delay={index * SWEEP_STAGGER} run={inView} still={still} hidden={focus !== null && focus !== index} />
              </g>
            ))}
          </svg>
        </div>
        <ul className={styles.legend}>
          {list.map((ring, index) => (
            <li key={ring.label}>
              <button
                type="button"
                className={styles.item}
                aria-pressed={(controlled ? active : pinned) === index}
                data-on={focus === index ? '' : undefined}
                data-off={focus !== null && focus !== index ? '' : undefined}
                onPointerEnter={(event) => { if (event.pointerType === 'mouse') preview(index) }}
                onPointerLeave={(event) => { if (event.pointerType === 'mouse') preview(null) }}
                onFocus={() => preview(index)}
                onBlur={() => preview(null)}
                onClick={() => pin(index)}
              >
                <span className={styles.dot}>{ring.icon}</span>
                <span className={styles.text}>
                  <span className={styles.name}>{ring.label}</span>
                  <span className={styles.value}>
                    <CountUp value={ring.value} format={round} duration={SWEEP_DURATION} still={still} className={styles.number} />
                    <span className={styles.goal}>/{ring.goal} {ring.unit}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}
