'use client'
import { AnimatePresence, motion } from 'motion/react'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { AlertIcon } from '@fetaui/react/rounded/alert'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { XIcon } from '@fetaui/react/rounded/x'
import { spring } from '../../motion-tokens'
import { Badge, type BadgeTone } from '../badge/badge'
import { Card } from '../card/card'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './uptime-card.module.css'

/** Mobile shows the latest half of the days. */
const DEFAULT_DAYS = 90
const DAY_MS = 86400000

export type UptimeStatus = 'operational' | 'degraded' | 'outage'

export type UptimeIncident = {
  /** 0 is today. */
  daysAgo: number
  status: Exclude<UptimeStatus, 'operational'>
  /** Like `API degraded for 14 min`. */
  title: string
  /** Like `elevated latency in us-east`. Shown after the date. */
  detail: string
}

export type UptimeService = { name: string; uptime: string; incidents?: UptimeIncident[] }

/** One day of one service, addressed by its row and how long ago it was. */
export type UptimeDay = { service: number; daysAgo: number }

export type UptimeCardProps = {
  services: UptimeService[]
  title?: ReactNode
  /** Default 90 on Web, and the latest half of these on Mobile. */
  days?: number
  /** The day counted as today. Default the current date. */
  today?: Date
  /** The story shown without hovering, for docs and tests. */
  active?: UptimeDay | null
  /** The pinned day. Controlled when set. `null` is none. */
  pinned?: UptimeDay | null
  defaultPinned?: UptimeDay | null
  onPinnedChange?: (day: UptimeDay | null) => void
  locale?: string
  animated?: boolean
  className?: string
}

const same = (a: UptimeDay | null | undefined, b: UptimeDay | null | undefined): boolean => a?.service === b?.service && a?.daysAgo === b?.daysAgo

type RowProps = {
  service: UptimeService
  index: number
  days: number
  active: number | null
  stop: number | null
  name: (daysAgo: number) => string
}

/** One row of bars. Memoised: moving over a row re-renders that row, not all 360 buttons. */
const Row = memo(function Row({ service, index, days, active, stop, name }: RowProps) {
  const incidents = useMemo(() => new Map(service.incidents?.map((item) => [item.daysAgo, item])), [service.incidents])
  return (
    <div className={styles.service}>
      <div className={styles.label}><span className={styles.name}>{service.name}</span><span className={styles.uptime}>{service.uptime}</span></div>
      <div className={styles.days} role="group" aria-label={service.name}>
        {Array.from({ length: days }, (_, i) => {
          const daysAgo = days - 1 - i
          return (
            <button
              key={daysAgo}
              type="button"
              className={styles.day}
              data-service={index}
              data-ago={daysAgo}
              data-status={incidents.get(daysAgo)?.status}
              data-active={active === daysAgo ? '' : undefined}
              data-older={daysAgo >= days / 2 ? '' : undefined}
              tabIndex={stop === daysAgo ? 0 : -1}
              aria-label={name(daysAgo)}
            />
          )
        })}
      </div>
    </div>
  )
})

/** Daily status bars per service. Hover previews a day's story, click pins it. */
export function UptimeCard({ services, title = 'System status', days = DEFAULT_DAYS, today, active: activeProp, pinned: pinnedProp, defaultPinned = null, onPinnedChange, locale = 'en-US', animated = true, className }: UptimeCardProps) {
  const still = useStill(animated)
  const [now] = useState(() => today ?? new Date())
  const base = today ?? now
  const [heldPin, setHeldPin] = useState<UptimeDay | null>(defaultPinned)
  const [hover, setHover] = useState<UptimeDay | null>(null)
  const [stop, setStop] = useState<UptimeDay>({ service: 0, daysAgo: 0 })
  const root = useRef<HTMLDivElement>(null)
  const pinned = pinnedProp === undefined ? heldPin : pinnedProp
  const shown = activeProp ?? hover ?? pinned
  const isPinned = Boolean(shown && same(shown, pinned))
  const date = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }), [locale])
  const dateAt = useCallback((daysAgo: number): string => date.format(new Date(base.getTime() - daysAgo * DAY_MS)), [date, base])
  const incidentAt = (day: UptimeDay): UptimeIncident | undefined => services[day.service]?.incidents?.find((item) => item.daysAgo === day.daysAgo)

  const worst = services.flatMap((service) => service.incidents ?? []).filter((item) => item.daysAgo === 0)
  const tone: BadgeTone = worst.some((item) => item.status === 'outage') ? 'danger' : worst.length ? 'warning' : 'success'

  // Each row gets a stable name function, so memo holds on the rows that are not touched.
  const namers = useMemo(() => services.map((service) => (daysAgo: number): string => {
    const incident = service.incidents?.find((item) => item.daysAgo === daysAgo)
    return `${service.name}, ${dateAt(daysAgo)}: ${incident ? `${incident.title}, ${incident.detail}` : 'operational'}`
  }), [services, dateAt])

  function pin(day: UptimeDay | null): void {
    setHeldPin(day)
    onPinnedChange?.(day)
  }

  // Webkit does not focus a clicked button, so Escape listens on the window while a day is pinned.
  useEffect(() => {
    if (!pinned) return
    const onEscape = (event: globalThis.KeyboardEvent): void => {
      if (event.key === 'Escape') { setHeldPin(null); onPinnedChange?.(null) }
    }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [pinned, onPinnedChange])

  function dayOf(target: EventTarget): UptimeDay | null {
    const node = (target as HTMLElement).closest<HTMLElement>('[data-ago]')
    return node ? { service: Number(node.dataset.service), daysAgo: Number(node.dataset.ago) } : null
  }

  function onOver(event: MouseEvent<HTMLDivElement>): void {
    const day = dayOf(event.target)
    if (day) setHover((current) => (same(current, day) ? current : day))
  }

  function onFocus(event: FocusEvent<HTMLDivElement>): void {
    const day = dayOf(event.target)
    if (!day) return
    setHover(day)
    setStop(day)
  }

  function onClick(event: MouseEvent<HTMLDivElement>): void {
    const day = dayOf(event.target)
    if (day) pin(same(day, pinned) ? null : day)
  }

  function move(day: UptimeDay): void {
    root.current?.querySelector<HTMLElement>(`[data-service="${day.service}"][data-ago="${day.daysAgo}"]`)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const day = dayOf(event.target)
    if (event.key === 'Escape') { setHover(null); return }
    if (!day) return
    const narrow = (event.target as HTMLElement).offsetParent !== null && getComputedStyle(root.current?.querySelector('[data-older]') ?? document.body).display === 'none'
    const oldest = (narrow ? Math.floor(days / 2) : days) - 1
    const next: UptimeDay | null =
      event.key === 'ArrowLeft' ? { ...day, daysAgo: Math.min(oldest, day.daysAgo + 1) }
      : event.key === 'ArrowRight' ? { ...day, daysAgo: Math.max(0, day.daysAgo - 1) }
      : event.key === 'ArrowUp' ? { ...day, service: Math.max(0, day.service - 1) }
      : event.key === 'ArrowDown' ? { ...day, service: Math.min(services.length - 1, day.service + 1) }
      : event.key === 'Home' ? { ...day, daysAgo: oldest }
      : event.key === 'End' ? { ...day, daysAgo: 0 }
      : null
    if (!next) return
    event.preventDefault()
    move(next)
  }

  const incident = shown ? incidentAt(shown) : undefined
  const status: UptimeStatus = incident?.status ?? 'operational'
  const story = shown ? `${shown.service}-${shown.daysAgo}` : 'hint'

  return (
    <Card className={className} bodyClassName={styles.body} animated={animated}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <Badge tone={tone} animated={animated}>
          <span className={styles.long}>{tone === 'success' ? 'All systems operational' : 'Partial incident'}</span>
          <span className={styles.short}>{tone === 'success' ? 'Operational' : 'Incident'}</span>
        </Badge>
      </div>
      <div className={styles.slot}>
        <AnimatePresence initial={false} mode="popLayout">
          {shown ? (
            <motion.div key={story} className={styles.detail} data-pinned={isPinned ? '' : undefined} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={still ? { duration: 0 } : spring.pop}>
              <span className={styles.state} data-status={status}>{status === 'operational' ? <CheckIcon size={12} /> : <AlertIcon size={12} />}</span>
              <div className={styles.detailText}>
                <p className={styles.headline}>{incident?.title ?? `${services[shown.service]?.name ?? ''} operational`}</p>
                <p className={styles.meta}>{dateAt(shown.daysAgo)} · {incident?.detail ?? 'no incidents'}</p>
              </div>
              {isPinned
                ? <IconButton variant="ghost" size="sm" icon={<XIcon />} label="Unpin" animated={animated} onClick={() => pin(null)} />
                : <span className={styles.meta}>Click to pin</span>}
            </motion.div>
          ) : (
            <motion.p key="hint" className={styles.hint} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={still ? { duration: 0 } : spring.pop}>Hover a day to see what happened</motion.p>
          )}
        </AnimatePresence>
      </div>
      <div ref={root} className={styles.bars} data-still={still ? '' : undefined} onMouseOver={onOver} onMouseLeave={() => setHover(null)} onFocus={onFocus} onBlur={() => setHover(null)} onClick={onClick} onKeyDown={onKeyDown}>
        {services.map((service, index) => (
          <Row
            key={service.name}
            service={service}
            index={index}
            days={days}
            active={shown?.service === index ? shown.daysAgo : null}
            stop={stop.service === index ? stop.daysAgo : null}
            name={namers[index] ?? String}
          />
        ))}
      </div>
      <div className={styles.axis}>
        <span className={cx(styles.meta, styles.long)}>{days} days ago</span>
        <span className={cx(styles.meta, styles.short)}>{Math.floor(days / 2)} days ago</span>
        <span className={styles.meta}>Today</span>
      </div>
    </Card>
  )
}

