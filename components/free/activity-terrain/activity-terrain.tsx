'use client'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { Card } from '../card/card'
import { cx, useStill } from '../motion-kit/motion-kit'
import { ToggleGroup } from '../toggle-group/toggle-group'
import styles from './activity-terrain.module.css'

/** Below this width the card shows the last 16 weeks. */
const COMPACT_WIDTH = 400
const COMPACT_WEEKS = 16
/** Terrain toggle: pillars rise with 8 ms between weeks. */
const RISE_STAGGER = 8
/** A vertical drag this long on the terrain changes the camera. */
const CAMERA_DRAG = 24
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DAY_MS = 86400000

/** Projections measured from the Terrain and Orbit frames, Web and Mobile. */
type Camera = { width: number; height: number; origin: [number, number]; week: [number, number]; day: [number, number]; front: [number, number]; side: [number, number]; unit: number; floor: number }
const CAMERAS: Record<'terrain' | 'orbit', Record<'web' | 'mobile', Camera>> = {
  terrain: {
    web: { width: 624, height: 300, origin: [112.7, 76.8], week: [17.5, 5.5], day: [-10.5, 7], front: [15.05, 4.73], side: [9.03, 6.02], unit: 4.8, floor: 1.5 },
    mobile: { width: 310, height: 220, origin: [65.6, 62.4], week: [14, 4.4], day: [-8.4, 5.6], front: [12.04, 3.78], side: [7.22, 4.82], unit: 3.84, floor: 1.2 },
  },
  orbit: {
    web: { width: 624, height: 300, origin: [81.8, 112.5], week: [19, 3], day: [-6, 11], front: [16.34, 2.58], side: [5.16, 9.46], unit: 6, floor: 1.5 },
    mobile: { width: 310, height: 220, origin: [46.8, 70.8], week: [15.2, 2.4], day: [-4.8, 8.8], front: [13.07, 2.07], side: [4.13, 7.57], unit: 4.8, floor: 1.2 },
  },
}

export type TerrainView = 'flat' | 'terrain' | 'orbit'

export type ActivityTerrainProps = {
  /** One array of seven daily counts per week, Sunday first, oldest week first. */
  weeks: number[][]
  /** The Sunday of the first week. */
  start: Date
  view?: TerrainView
  defaultView?: TerrainView
  onViewChange?: (view: TerrainView) => void
  /** Lights one day, as `[week, day]`, for documentation. */
  previewDay?: [number, number]
  /** Default `Activity`. */
  title?: string
  locale?: string
  /** `false` switches views at once. */
  animated?: boolean
  className?: string
}

const level = (count: number): number => (count >= 8 ? 4 : count >= 5 ? 3 : count >= 3 ? 2 : count >= 1 ? 1 : 0)
const plural = (count: number): string => `${count} contribution${count === 1 ? '' : 's'}`
/** The tallest count that rises at full scale. Busier grids scale down so the tallest pillar stays inside the card. */
const TALLEST = 16

/** A contribution grid in five ink steps that rises into an isometric terrain. */
export function ActivityTerrain({ weeks, start, view, defaultView = 'flat', onViewChange, previewDay, title = 'Activity', locale = 'en-US', animated = true, className }: ActivityTerrainProps) {
  const still = useStill(animated)
  const root = useRef<HTMLDivElement>(null)
  const dragFrom = useRef<number | null>(null)
  const [compact, setCompact] = useState(false)
  const [held, setHeld] = useState(defaultView)
  const [hovered, setHovered] = useState<number | null>(null)
  const [cursor, setCursor] = useState<number | null>(null)
  const current = view ?? held

  useEffect(() => {
    const node = root.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setCompact((entry?.contentRect.width ?? COMPACT_WIDTH) < COMPACT_WIDTH))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const first = compact ? Math.max(weeks.length - COMPACT_WEEKS, 0) : 0
  const shown = useMemo(() => weeks.slice(first), [weeks, first])
  const total = useMemo(() => shown.flat().reduce((sum, count) => sum + count, 0), [shown])
  const date = (week: number, day: number): Date => new Date(start.getTime() + (week * 7 + day) * DAY_MS + DAY_MS / 2)
  const dayName = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }), [locale])
  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short' }), [locale])

  const months = useMemo(() => {
    const list: { column: number; name: string }[] = []
    let previous = -1
    shown.forEach((_, column) => {
      const month = date(first + column, 0).getMonth()
      if (month !== previous) list.push({ column, name: monthName.format(date(first + column, 0)) })
      previous = month
    })
    return list
    // `date` only reads `start`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, first, start, monthName])

  const preview = previewDay ? previewDay[0] * 7 + previewDay[1] : null
  const active = hovered ?? cursor ?? preview
  const activeWeek = active === null ? 0 : Math.floor(active / 7)
  const activeDay = active === null ? 0 : active % 7
  const activeCount = weeks[activeWeek]?.[activeDay] ?? 0
  const lit = active !== null && activeWeek >= first
  const subtitle = lit
    ? `${plural(activeCount)} on ${dayName.format(date(activeWeek, activeDay))}`
    : compact ? `${total} in the last ${shown.length} weeks` : `${plural(total)} in the last ${shown.length} weeks`

  const camera = CAMERAS[current === 'orbit' ? 'orbit' : 'terrain'][compact ? 'mobile' : 'web']
  const [fx, fy] = camera.front
  const [sx, sy] = camera.side
  const pillars = useMemo(() => {
    const peak = Math.max(TALLEST, ...shown.flat())
    const unit = (camera.unit * TALLEST) / peak
    const list = shown.flatMap((days, column) => days.map((count, day) => ({
      index: (first + column) * 7 + day,
      column,
      day,
      count,
      x: camera.origin[0] + column * camera.week[0] + day * camera.day[0],
      y: camera.origin[1] + column * camera.week[1] + day * camera.day[1],
      height: count ? Math.max(count * unit, camera.floor) : camera.floor,
    })))
    return list.sort((a, b) => a.column + a.day - (b.column + b.day))
  }, [shown, first, camera])

  function choose(next: TerrainView): void {
    setHeld(next)
    onViewChange?.(next)
  }

  function focusCell(index: number): void {
    setCursor(index)
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>(`[data-layer="${current === 'flat' ? 'flat' : 'terrain'}"] [data-cell="${index}"]`)?.focus())
  }

  function onKey(event: KeyboardEvent<HTMLDivElement>): void {
    if (current !== 'flat' && event.key.toLowerCase() === 'o') { choose(current === 'orbit' ? 'terrain' : 'orbit'); return }
    const moves: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const from = cursor ?? first * 7
    const next = from + move
    const sameColumn = Math.abs(move) === 1 ? Math.floor(next / 7) === Math.floor(from / 7) : true
    if (sameColumn && next >= first * 7 && next < weeks.length * 7) focusCell(next)
  }

  function dragEnd(event: PointerEvent<HTMLDivElement>): void {
    if (dragFrom.current === null) return
    const moved = event.clientY - dragFrom.current
    dragFrom.current = null
    if (moved > CAMERA_DRAG && current === 'terrain') choose('orbit')
    if (moved < -CAMERA_DRAG && current === 'orbit') choose('terrain')
  }

  const stop = cursor ?? first * 7
  const chip = lit && current !== 'flat' ? pillars.find(({ index }) => index === active) : undefined

  return (
    <Card className={cx(styles.terrain, className)} bodyClassName={styles.body} aria-label={title} animated={animated}>
      <div ref={root} className={styles.frame} data-view={current} data-compact={compact ? '' : undefined} data-still={still ? '' : undefined} data-active={lit ? '' : undefined}>
        <div className={styles.header}>
          <div className={styles.text}>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.subtitle} aria-live="polite">{subtitle}</p>
          </div>
          <ToggleGroup type="single" label="View" value={current === 'flat' ? 'flat' : 'terrain'} items={[{ value: 'flat', label: 'Flat' }, { value: 'terrain', label: 'Terrain' }]} animated={animated} onValueChange={(next) => choose(next === 'flat' ? 'flat' : 'terrain')} />
        </div>

        <div
          className={styles.area}
          onKeyDown={onKey}
          onPointerLeave={() => setHovered(null)}
          onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setCursor(null) }}
          onPointerDown={(event) => { dragFrom.current = current === 'flat' ? null : event.clientY }}
          onPointerUp={dragEnd}
        >
          <div className={styles.flat} data-layer="flat" inert={current === 'flat' ? undefined : true} style={{ '--weeks': shown.length } as CSSProperties}>
            <div className={styles.heat}>
              <div className={styles.months} aria-hidden="true">{months.map(({ column, name }) => <span key={column} style={{ gridColumn: column + 1 }}>{name}</span>)}</div>
              {DAYS.map((day, row) => <span key={day} className={styles.dayLabel} style={{ gridRow: row + 2 }} aria-hidden="true">{row % 2 ? day : ''}</span>)}
              {shown.map((days, column) => days.map((count, row) => {
                const index = (first + column) * 7 + row
                return (
                  <button
                    key={index}
                    type="button"
                    className={styles.cell}
                    style={{ gridColumn: column + 2, gridRow: row + 2 }}
                    data-cell={index}
                    data-level={level(count)}
                    data-on={index === active ? '' : undefined}
                    tabIndex={index === stop ? 0 : -1}
                    aria-label={`${plural(count)} on ${dayName.format(date(first + column, row))}`}
                    onPointerEnter={() => setHovered(index)}
                    onFocus={() => setCursor(index)}
                  />
                )
              }))}
            </div>
          </div>

          <div className={styles.rise} data-layer="terrain" inert={current === 'flat' ? true : undefined}>
            <svg key={current === 'orbit' ? 'orbit' : 'terrain'} className={styles.svg} viewBox={`0 0 ${camera.width} ${camera.height}`} role="group" aria-label={`${title} terrain. Use the arrow keys to move between days, and O to change the camera.`}>
              {pillars.map(({ index, column, x, y, height, count }) => (
                <g
                  key={index}
                  className={styles.pillar}
                  transform={`translate(${x} ${y})`}
                  style={{ '--h': height, '--delay': `${column * RISE_STAGGER}ms` } as CSSProperties}
                  data-cell={index}
                  data-level={level(count)}
                  data-on={index === active ? '' : undefined}
                  role="img"
                  tabIndex={index === stop ? 0 : -1}
                  aria-label={`${plural(count)} on ${dayName.format(date(Math.floor(index / 7), index % 7))}`}
                  onPointerEnter={() => setHovered(index)}
                  onFocus={() => setCursor(index)}
                >
                  <g transform={`matrix(1 ${fy / fx} 0 1 0 ${sy})`}><rect className={styles.wall} y={-height} width={fx} height={height} /></g>
                  <g transform={`matrix(1 ${-sy / sx} 0 1 ${fx} ${fy + sy})`}><rect className={styles.wall} y={-height} width={sx} height={height} /></g>
                  <polygon className={styles.top} points={`${sx},0 ${sx + fx},${fy} ${fx},${fy + sy} 0,${sy}`} />
                </g>
              ))}
            </svg>
            {chip ? (
              <span className={styles.chip} style={{ left: `${((chip.x + (fx + sx) / 2) / camera.width) * 100}%`, top: `${((chip.y - chip.height) / camera.height) * 100}%` }} aria-hidden="true">{chip.count}</span>
            ) : null}
          </div>
        </div>

        <div className={styles.legend} aria-hidden="true">
          <span>Less</span>
          <span className={styles.swatches}>{[0, 1, 2, 3, 4].map((step) => <i key={step} className={styles.swatch} data-level={step} />)}</span>
          <span>More</span>
        </div>
      </div>
    </Card>
  )
}
