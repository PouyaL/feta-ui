'use client'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { FlipHorizontalIcon } from '@fetaui/react/rounded/flip-horizontal'
import { Badge } from '../badge/badge'
import { Button } from '../button/button'
import { Card } from '../card/card'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Separator } from '../separator/separator'
import styles from './card-flip.module.css'

/** Card flip: 600 ms, spring 0.2. */
const FLIP_SPRING = { type: 'spring', duration: 0.6, bounce: 0.2 } as const

export type FlipSide = 'front' | 'back'

export type Ticket = {
  kicker: string
  tier: string
  volume: string
  event: string
  date: string
  doors: string
  venue: string
  holder: string
  number: string
  gate: string
  section: string
  row: string
  seat: string
  terms: string
}

export type CardFlipProps = {
  /** `turning` holds the mid flip pose. Leave it out to keep the side here. */
  side?: FlipSide | 'turning'
  defaultSide?: FlipSide
  onSideChange?: (side: FlipSide) => void
  ticket?: Ticket
  /** Replaces the ticket front. */
  front?: ReactNode
  /** Replaces the ticket back. It must be the same size. */
  back?: ReactNode
  /** `false` swaps the sides at once. */
  animated?: boolean
  className?: string
}

const TICKET: Ticket = {
  kicker: 'Admit one', tier: 'GA', volume: 'Vol. 04', event: 'Fieldwork Sessions', date: 'Sat 21 Nov', doors: '19:30', venue: 'Hall B, Pier 7', holder: 'Jordan Vale',
  number: '004182', gate: 'C', section: 'Floor', row: 'F', seat: '14', terms: 'Valid for one entry. Re-entry is not permitted.',
}

const Datum = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.datum}><dt className={styles.label}>{label}</dt><dd className={styles.value}>{value}</dd></div>
)

function TicketFront({ ticket, animated }: { ticket: Ticket; animated: boolean }) {
  return (
    <div className={styles.front}>
      <div className={styles.frontHead}><span className={styles.label}>{ticket.kicker}</span><Badge size="sm" mark={false} animated={animated}>{ticket.tier}</Badge></div>
      <div className={styles.art}><span className={styles.label}>{ticket.volume}</span><h3 className={styles.event}>{ticket.event}</h3></div>
      <dl className={styles.details}><Datum label="Date" value={ticket.date} /><Datum label="Doors" value={ticket.doors} /><Datum label="Venue" value={ticket.venue} /></dl>
      <Separator animated={animated} />
      <div className={styles.holder}><dl className={styles.plain}><Datum label="Holder" value={ticket.holder} /></dl><span className={styles.mono}>No. {ticket.number}</span></div>
    </div>
  )
}

/** A stand-in pattern seeded from the ticket number. Pass `back` for a real code. */
function QrArt({ seed }: { seed: string }) {
  const cells = useMemo(() => {
    let hash = 7
    for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
    const list: [number, number][] = []
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0
        const finder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)
        if (!finder && hash >>> 31) list.push([x, y])
      }
    }
    return list
  }, [seed])
  return (
    <svg viewBox="0 0 21 21" className={styles.qrArt} aria-hidden="true">
      {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" rx="0.2" />)}
      {[[0, 0], [14, 0], [0, 14]].map(([x = 0, y = 0]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width="6" height="6" rx="1" fill="none" stroke="currentColor" />
          <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.5" />
        </g>
      ))}
    </svg>
  )
}

function TicketBack({ ticket }: { ticket: Ticket }) {
  return (
    <div className={styles.back}>
      <span className={styles.label}>Scan at entry</span>
      <div className={styles.qr}><QrArt seed={ticket.number} /></div>
      <span className={styles.number}>#{ticket.number}</span>
      <dl className={styles.seat}><Datum label="Gate" value={ticket.gate} /><Datum label="Section" value={ticket.section} /><Datum label="Row" value={ticket.row} /><Datum label="Seat" value={ticket.seat} /></dl>
      <p className={styles.terms}>{ticket.terms}</p>
    </div>
  )
}

/** A ticket that turns in 3D. Both sides are the same size, and the shade peaks halfway round. */
export function CardFlip({ side, defaultSide = 'front', onSideChange, ticket = TICKET, front, back, animated = true, className }: CardFlipProps) {
  const still = useStill(animated)
  const reduce = useReducedMotion()
  const [own, setOwn] = useState<FlipSide>(defaultSide)
  const [flipping, setFlipping] = useState(false)
  const held = side === 'turning'
  const current: FlipSide = side === 'front' || side === 'back' ? side : own
  const rotate = useMotionValue(current === 'back' ? 180 : 0)
  const shade = useTransform(rotate, (angle) => Math.sin(Math.min(angle, 180) * Math.PI / 180) ** 2)
  const running = useRef<ReturnType<typeof animate> | null>(null)

  useEffect(() => {
    const target = current === 'back' ? 180 : 0
    if (rotate.get() === target) return
    if (still) { rotate.set(target); return }
    setFlipping(true)
    running.current?.stop()
    running.current = animate(rotate, target, { ...FLIP_SPRING, onComplete: () => setFlipping(false) })
    return () => running.current?.stop()
  }, [current, rotate, still])

  function flip(): void {
    const next: FlipSide = current === 'front' ? 'back' : 'front'
    setOwn(next)
    onSideChange?.(next)
  }

  function onKey(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    flip()
  }

  const busy = held || flipping
  const target = current === 'front' ? 'back' : 'front'
  const meta = busy ? 'Turning' : `${current === 'front' ? 'Front' : 'Back'} · tap to flip`
  const faceFront = front ?? <TicketFront ticket={ticket} animated={animated} />
  const faceBack = back ?? <TicketBack ticket={ticket} />

  return (
    <Card
      className={cx(styles.flip, className)}
      bodyClassName={styles.stage}
      footerClassName={styles.footer}
      aria-label={`${ticket.event} ticket`}
      animated={animated}
      footer={
        <>
          <span className={styles.meta}>{meta}</span>
          <Button size="sm" variant="secondary" className={styles.button} data-busy={busy ? '' : undefined} leadingIcon={<FlipHorizontalIcon />} aria-label={`Flip to the ${target}`} animated={animated} onClick={flip} onKeyDown={onKey}>Flip</Button>
        </>
      }
    >
      <span className={styles.srOnly} aria-live="polite">{`Showing the ${current}`}</span>
      {held ? (
        <div className={styles.held}>
          <div className={styles.heldBack}>{faceBack}</div>
          <div className={styles.heldFront}>{faceFront}<span className={styles.heldShade} /></div>
        </div>
      ) : still ? (
        <div className={styles.fade} data-animate={reduce && animated ? '' : undefined} onClick={flip}>
          <div className={styles.fadeFace} data-on={current === 'front' ? '' : undefined} inert={current !== 'front'}>{faceFront}</div>
          <div className={styles.fadeFace} data-on={current === 'back' ? '' : undefined} inert={current !== 'back'}>{faceBack}</div>
        </div>
      ) : (
        <div className={styles.scene} onClick={flip}>
          <motion.div className={styles.turner} style={{ rotateY: rotate }}>
            <div className={styles.face} inert={current !== 'front'}>{faceFront}<motion.span className={styles.shade} style={{ opacity: shade }} /></div>
            <div className={styles.face} data-back="" inert={current !== 'back'}>{faceBack}<motion.span className={styles.shade} style={{ opacity: shade }} /></div>
          </motion.div>
        </div>
      )}
      {busy ? <span className={styles.hint}>Flipping to the {target}</span> : null}
    </Card>
  )
}
