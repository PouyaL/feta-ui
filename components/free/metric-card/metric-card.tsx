'use client'
import { motion, useInView } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { TrendingDownIcon } from '@fetaui/react/rounded/trending-down'
import { TrendingUpIcon } from '@fetaui/react/rounded/trending-up'
import { ease } from '../../motion-tokens'
import { Badge } from '../badge/badge'
import { Card } from '../card/card'
import { RollingText, cx, useStill } from '../motion-kit/motion-kit'
import { Separator } from '../separator/separator'
import { ToggleGroup } from '../toggle-group/toggle-group'
import styles from './metric-card.module.css'

const CHART_HEIGHT = 128
const CHART_WIDTH = 396
/** Room for the end dot. */
const RIGHT_INSET = 4
const TOP = 10
const BOTTOM = 118
/** Every period resamples to this many points, so the paths can morph. */
const POINTS = 30
/** Line and arcs draw in: 600 ms. Period morph: 400 ms. */
const DRAW_DURATION = 0.6
const MORPH_DURATION = 0.4
const DASH_EVENT = '2 3'
const DASH_PREVIOUS = '4 4'

export type MetricSegment = { name: string; value: number }

export type MetricEvent = {
  /** Index into `current`. */
  index: number
  label: string
}

export type MetricPeriod = {
  /** Like `30D`. */
  label: string
  /** The headline number. */
  value: number
  /** Percent change, like 6.8. */
  delta: number
  /** Like `vs previous 30 days`. */
  compare: string
  current: number[]
  previous: number[]
  /** One label per day, like `Sat, Oct 3`. */
  labels: string[]
  /** Axis start and end. */
  from: string
  to: string
  events?: MetricEvent[]
  segments: MetricSegment[]
}

export type MetricCardProps = {
  title?: ReactNode
  periods: MetricPeriod[]
  /** The period label. Controlled when set. */
  period?: string
  defaultPeriod?: string
  onPeriodChange?: (period: string) => void
  /** Starts on this day index, as if pointed at. */
  defaultDay?: number | null
  /** Starts with this segment focused. */
  defaultSegment?: string | null
  format?: (value: number) => string
  animated?: boolean
  className?: string
}

const DOLLARS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const dollars = (value: number): string => DOLLARS.format(value)
const TONES = ['solid', 'mid', 'soft'] as const

function resample(values: number[]): number[] {
  return Array.from({ length: POINTS }, (_, i) => {
    const at = (i / (POINTS - 1)) * (values.length - 1)
    const low = Math.floor(at)
    const a = values[low] ?? 0
    return a + ((values[Math.min(low + 1, values.length - 1)] ?? a) - a) * (at - low)
  })
}

const round = (value: number): number => Math.round(value * 10) / 10

/** One number with its trend: a period switch, a line over an area, and a share breakdown. */
export function MetricCard({ title = 'Revenue', periods, period, defaultPeriod, onPeriodChange, defaultDay = null, defaultSegment = null, format = dollars, animated = true, className }: MetricCardProps) {
  const still = useStill(animated)
  const [heldPeriod, setHeldPeriod] = useState(defaultPeriod ?? periods[0]?.label ?? '')
  const [day, setDay] = useState<number | null>(defaultDay)
  const [segment, setSegment] = useState<string | null>(defaultSegment)
  const [width, setWidth] = useState(CHART_WIDTH)
  const chart = useRef<HTMLDivElement>(null)
  const inView = useInView(chart, { once: true })
  const active = periods.find((item) => item.label === (period ?? heldPeriod)) ?? periods[0]

  useEffect(() => {
    const node = chart.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(entry.contentRect.width) })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const shape = useMemo(() => {
    if (!active) return null
    const { current, previous } = active
    const all = [...current, ...previous]
    const low = Math.min(...all)
    const span = Math.max(...all) - low || 1
    const plot = width - RIGHT_INSET
    const x = (index: number, count: number): number => round((index / (count - 1)) * plot)
    const y = (value: number): number => round(BOTTOM - ((value - low) / span) * (BOTTOM - TOP))
    const path = (values: number[]): string => values.map((value, i) => `${i ? 'L' : 'M'}${x(i, values.length)} ${y(value)}`).join(' ')
    const line = path(resample(current))
    return { x, y, line, previous: path(resample(previous)), area: `${line} L${plot} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z` }
  }, [active, width])

  if (!active || !shape) return null

  const count = active.current.length
  const dayValue = day === null ? undefined : active.current[day]
  const average = active.current.reduce((all, value) => all + value, 0) / count
  const gap = dayValue === undefined ? 0 : Math.round(((dayValue - average) / average) * 100)
  const sum = active.segments.reduce((all, item) => all + item.value, 0)
  const last = active.current[count - 1] ?? 0
  const morph = still ? { duration: 0 } : { duration: MORPH_DURATION, ease: ease.out }
  const reveal = (fraction: number): string => `inset(-8px ${Math.round(width * fraction)}px -8px 0px)`

  function changePeriod(next: string): void {
    setHeldPeriod(next)
    setDay(null)
    onPeriodChange?.(next)
  }

  function pick(event: PointerEvent<HTMLDivElement>): void {
    const box = event.currentTarget.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (event.clientX - box.left) / (box.width - RIGHT_INSET)))
    setDay(Math.round(fraction * (count - 1)))
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const from = day ?? count - 1
    const next = event.key === 'ArrowLeft' ? from - 1 : event.key === 'ArrowRight' ? from + 1 : event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : null
    if (event.key === 'Escape') setDay(null)
    if (next === null) return
    event.preventDefault()
    setDay(Math.min(count - 1, Math.max(0, next)))
  }

  const dayText = `${active.labels[day ?? 0] ?? ''} · ${gap === 0 ? 'at' : `${Math.abs(gap)}% ${gap > 0 ? 'above' : 'below'}`} the daily average`

  return (
    <Card className={className} bodyClassName={styles.body} animated={animated}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <ToggleGroup type="single" label="Period" items={periods.map(({ label }) => ({ value: label, label }))} value={active.label} onValueChange={changePeriod} animated={animated} />
      </div>
      <div className={styles.value}>
        <p className={styles.number}><RollingText value={format(dayValue ?? active.value)} still={still} /></p>
        <div className={styles.delta}>
          {dayValue === undefined ? (
            <>
              <Badge size="sm" tone={active.delta >= 0 ? 'success' : 'danger'} icon={active.delta >= 0 ? <TrendingUpIcon size={12} /> : <TrendingDownIcon size={12} />} animated={animated}>{Math.abs(active.delta)}%</Badge>
              <span className={styles.meta}>{active.compare}</span>
            </>
          ) : <span className={styles.meta}>{dayText}</span>}
        </div>
      </div>
      <div className={styles.chartWrap}>
        <div
          ref={chart}
          className={styles.chart}
          role="slider"
          tabIndex={0}
          aria-label={`${typeof title === 'string' ? title : 'Value'} by day`}
          aria-valuemin={0}
          aria-valuemax={count - 1}
          aria-valuenow={day ?? count - 1}
          aria-valuetext={`${active.labels[day ?? count - 1] ?? ''}: ${format(dayValue ?? last)}`}
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setDay(null)}
          onBlur={() => setDay(null)}
          onKeyDown={onKeyDown}
        >
          <motion.svg
            className={styles.svg}
            width={width}
            height={CHART_HEIGHT}
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            aria-hidden="true"
            initial={still ? false : { clipPath: reveal(1) }}
            animate={{ clipPath: still || inView ? reveal(0) : reveal(1) }}
            transition={still ? { duration: 0 } : { duration: DRAW_DURATION, ease: ease.out }}
          >
            <motion.path className={styles.area} initial={false} animate={{ d: shape.area }} transition={morph} />
            <motion.path className={styles.previous} strokeDasharray={DASH_PREVIOUS} initial={false} animate={{ d: shape.previous }} transition={morph} />
            {active.events?.map((item) => {
              const at = shape.x(item.index, count)
              return <motion.line key={item.label} className={styles.event} strokeDasharray={DASH_EVENT} y1={0} y2={CHART_HEIGHT} initial={false} animate={{ x1: at, x2: at }} transition={morph} />
            })}
            <motion.path className={styles.line} initial={false} animate={{ d: shape.line }} transition={morph} />
            {active.events?.map((item) => <motion.circle key={item.label} className={styles.eventDot} r={3} initial={false} animate={{ cx: shape.x(item.index, count), cy: shape.y(active.current[item.index] ?? 0) }} transition={morph} />)}
            <motion.circle className={styles.today} r={4} initial={false} animate={{ cx: shape.x(count - 1, count), cy: shape.y(last) }} transition={morph} />
            {day !== null ? (
              <>
                <line className={styles.crosshair} x1={shape.x(day, count)} x2={shape.x(day, count)} y1={0} y2={CHART_HEIGHT} />
                <circle className={styles.focus} r={5} cx={shape.x(day, count)} cy={shape.y(dayValue ?? 0)} />
              </>
            ) : null}
          </motion.svg>
        </div>
        <div className={styles.axis}>
          <span className={styles.meta}>{active.from}</span>
          <span className={cx(styles.meta, styles.key)}><span className={styles.dash} />Previous period</span>
          <span className={styles.meta}>{active.to}</span>
        </div>
        <table className={styles.srOnly}>
          <caption>{typeof title === 'string' ? title : 'Value'}, {active.compare}</caption>
          <thead><tr><th>Day</th><th>Value</th><th>Previous</th></tr></thead>
          <tbody>{active.current.map((value, i) => <tr key={active.labels[i] ?? i}><td>{active.labels[i]}</td><td>{format(value)}</td><td>{format(active.previous[i] ?? 0)}</td></tr>)}</tbody>
        </table>
      </div>
      <Separator animated={animated} />
      <div className={styles.breakdown} data-still={still ? '' : undefined} data-focused={segment ? '' : undefined}>
        <div className={styles.share} aria-hidden="true">
          {active.segments.map((item, i) => <span key={item.name} data-tone={TONES[i] ?? 'soft'} data-on={item.name === segment ? '' : undefined} style={{ flexGrow: item.value }} />)}
        </div>
        <div className={styles.rows}>
          {active.segments.map((item, i) => (
            <button key={item.name} type="button" className={styles.row} aria-pressed={item.name === segment} data-on={item.name === segment ? '' : undefined} onClick={() => setSegment(item.name === segment ? null : item.name)}>
              <span className={styles.dot} data-tone={TONES[i] ?? 'soft'} />
              <span className={styles.rowName}>{item.name}</span>
              <span className={styles.rowValue}><RollingText value={format(item.value)} still={still} /></span>
              <span className={styles.rowShare}>{Math.round((item.value / sum) * 100)}%</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  )
}
