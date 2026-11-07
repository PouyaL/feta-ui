'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, type ReactNode } from 'react'
import { PlaneIcon } from '@fetaui/react/rounded/plane'
import { duration, ease, spring } from '../../motion-tokens'
import { Badge, type BadgeTone } from '../badge/badge'
import { Card } from '../card/card'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './boarding-pass.module.css'

export type PassStatus = 'on-time' | 'gate-change' | 'delayed' | 'boarding'

export type Flight = {
  airline: string
  flight: string
  from: { code: string; city: string; time: string }
  to: { code: string; city: string; time: string }
  gate: string
  boards: string
  seat: string
  group: string
  passenger: string
  date: string
  /** One line under the fields. */
  note: string
}

type Field = 'gate' | 'boards' | 'seat' | 'group'

/** What a status changes: new values, the Badge label and the field shown in the chip. */
export type StatusPatch = Partial<Flight> & { label?: string; changed?: Field }

export type BoardingPassProps = {
  /** Updates in place. Default `on-time`. */
  status?: PassStatus
  flight?: Flight
  /** Replaces the values each status changes. With a custom `flight`, a status changes only its Badge and chip until you pass these. */
  patches?: Partial<Record<PassStatus, StatusPatch>>
  /** A logo in the 24 px mark. */
  mark?: ReactNode
  /** `false` turns off the Badge pop and the crossfade. */
  animated?: boolean
  className?: string
}

const FLIGHT: Flight = {
  airline: 'Northwind', flight: 'NW 214',
  from: { code: 'LIS', city: 'Lisbon', time: '10:40' },
  to: { code: 'CPH', city: 'Copenhagen', time: '15:05' },
  gate: 'B12', boards: '10:05', seat: '14A', group: '2',
  passenger: 'Maya Chen', date: 'Thu, 12 Nov', note: 'Thu, 12 Nov · Doors close 15 min before departure',
}

const PATCHES: Record<PassStatus, StatusPatch> = {
  'on-time': { label: 'On time' },
  'gate-change': { label: 'Gate change', changed: 'gate', gate: 'B31', note: 'Gate moved to B31, 6 min walk from security' },
  delayed: { label: 'Delayed 25 min', changed: 'boards', boards: '10:30', from: { ...FLIGHT.from, time: '11:05' }, to: { ...FLIGHT.to, time: '15:30' }, note: 'Late inbound aircraft · new boarding 10:30' },
  boarding: { label: 'Boarding', changed: 'group', note: 'Group 2 is boarding now at gate B12' },
}

const TONES: Record<PassStatus, BadgeTone> = { 'on-time': 'success', 'gate-change': 'warning', delayed: 'danger', boarding: 'info' }
const FIELDS: [Field, string][] = [['gate', 'Gate'], ['boards', 'Boards'], ['seat', 'Seat'], ['group', 'Group']]

/** Bar widths in the 204 px barcode, seeded from the flight so a pass keeps its code. */
function barsFor(seed: string): [number, number][] {
  let hash = 11
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const bars: [number, number][] = []
  for (let x = 0; x < 204;) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0
    const width = (hash >>> 30) % 3 + 1
    if (x + width > 204) break
    bars.push([x, width])
    x += width + ((hash >>> 28) & 1) + 1
  }
  return bars
}

function Barcode({ seed }: { seed: string }) {
  const bars = useMemo(() => barsFor(seed), [seed])
  return (
    <span className={styles.barcode} aria-hidden="true">
      <svg viewBox="0 0 204 36" preserveAspectRatio="none" className={styles.bars}>
        {bars.map(([x, width]) => <rect key={x} x={x} width={width} height="36" />)}
      </svg>
    </span>
  )
}

/** A flight pass as an inset card over a stub. The Badge stamps a new status and the field that changed sits in a chip. */
export function BoardingPass({ status = 'on-time', flight = FLIGHT, patches, mark, animated = true, className }: BoardingPassProps) {
  const still = useStill(animated)
  // The built in values belong to the sample flight, so a custom one never takes them.
  const { label: baseLabel, changed: baseChanged, ...sample } = PATCHES[status]
  const { label = baseLabel, changed = baseChanged, ...values } = { ...(flight === FLIGHT ? sample : {}), ...patches?.[status] }
  const pass: Flight = { ...flight, ...values }
  const late = status === 'delayed'
  return (
    <Card
      className={cx(styles.pass, className)}
      bodyClassName={styles.body}
      footerClassName={styles.stubFooter}
      aria-label={`${pass.airline} ${pass.flight}, ${pass.from.code} to ${pass.to.code}`}
      animated={animated}
      footer={
        <>
          <div className={styles.tear} aria-hidden="true" />
          <div className={styles.stub}>
            <Barcode seed={`${pass.flight}${pass.seat}`} />
            <div className={styles.passenger}>
              <p className={styles.label}>Passenger</p>
              <p className={styles.person}>{pass.passenger}</p>
              <p className={styles.label}>{pass.date}</p>
            </div>
          </div>
        </>
      }
    >
      <div className={styles.header}>
        <div className={styles.airline}>
          <span className={styles.mark}>{mark ?? <PlaneIcon size={12} />}</span>
          <span className={styles.name}>{pass.airline}</span>
          <span className={styles.label}>{pass.flight}</span>
        </div>
        <span className={styles.status} aria-live="polite">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={status} className={styles.stamp} initial={still ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: duration.close } }} transition={spring.stamp}>
              <Badge size="sm" tone={TONES[status]} animated={animated}>{label}</Badge>
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
      <div className={styles.route}>
        <div className={styles.end}>
          <span className={styles.code}>{pass.from.code}</span>
          <span className={styles.place} data-late={late ? '' : undefined}>{pass.from.city} · <Swap value={pass.from.time} still={still} /></span>
        </div>
        <div className={styles.path} aria-hidden="true"><PlaneIcon size={16} /></div>
        <div className={styles.end} data-to="">
          <span className={styles.code}>{pass.to.code}</span>
          <span className={styles.place} data-late={late ? '' : undefined}><Swap value={pass.to.time} still={still} /> · {pass.to.city}</span>
        </div>
      </div>
      <dl className={styles.fields}>
        {FIELDS.map(([field, name]) => (
          <div key={field} className={styles.field} data-changed={changed === field ? '' : undefined}>
            <dt className={styles.label}>{name}</dt>
            <dd className={styles.fieldValue}><Swap value={pass[field]} still={still} /></dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}><Swap value={pass.note} still={still} /></p>
    </Card>
  )
}

/** The old value crossfades out. */
function Swap({ value, still }: { value: string; still: boolean }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={value} className={styles.swap} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }} transition={{ duration: duration.base, ease: ease.out }}>{value}</motion.span>
    </AnimatePresence>
  )
}
