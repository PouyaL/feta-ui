'use client'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react'
import { HardDriveIcon } from '@fetaui/react/rounded/hard-drive'
import { Badge } from '../badge/badge'
import { Button } from '../button/button'
import { Card } from '../card/card'
import { cx, useStill } from '../motion-kit/motion-kit'
import { CountUp } from '../card-kit/card-kit'
import styles from './liquid-gauge.module.css'

/** Gauge diameter on Web and Mobile. */
const SIZE = 168
/** Gauge change: amplitude 9 to 4 over 1200 ms, as a scale on the 4 px wave. */
const SLOSH_SCALE = 9 / 4
const SLOSH_TILT = -3
const SETTLE = { type: 'spring', duration: 1.2, bounce: 0.3 } as const
const SWAY = { type: 'spring', stiffness: 120, damping: 7 } as const
const DRIFT = { duration: 1.2, ease: 'easeOut' } as const
const MAX_DEVICE_TILT = 6
const DEVICE_TILT_SHARE = 0.2
/** The pointer tilts the liquid up to 6 degrees across the vessel; a tap splashes it. */
const POINTER_TILT = 6
/** The most the surface ever leans, in degrees. */
const MAX_TILT = 12
const SPLASH = { type: 'spring', stiffness: 90, damping: 6 } as const

const percent = (value: number): string => `${Math.round(value)}%`
const levelOf = (share: number): number => SIZE * (1 - share)

export type LiquidGaugeProps = {
  /** Amount used, in `unit`. */
  used: number
  total: number
  /** Default `GB`. */
  unit?: string
  /** Default `Storage`. */
  label?: string
  icon?: ReactNode
  /** Share of `total` where it turns Almost full. Default 0.9. */
  warnAt?: number
  /** Holds the wave at its tilted, tall pose. Changes to `used` slosh on their own. */
  slosh?: boolean
  /** Default `Manage storage`. */
  actionLabel?: string
  /** Default `Free up space`. */
  urgentActionLabel?: string
  onAction?: () => void
  animated?: boolean
  className?: string
}

// The surface carries a deep body below it, so a tilt or a splash never lifts it clear of the fill and opens a gap.
const WAVE = 'M0 12q42-8 84 0t84 0 84 0 84 0 84 0 84 0V160H0Z'

/** A quota as liquid in a circle. It rises to its level, sloshes and settles. */
export function LiquidGauge({ used, total, unit = 'GB', label = 'Storage', icon, warnAt = 0.9, slosh = false, actionLabel = 'Manage storage', urgentActionLabel = 'Free up space', onAction, animated = true, className }: LiquidGaugeProps) {
  const still = useStill(animated)
  const share = total > 0 ? Math.min(used / total, 1) : 0
  const value = share * 100
  const full = share >= warnAt
  const free = `${Math.max(total - used, 0).toFixed(1)} ${unit} free`
  const held = slosh && !still

  const level = useMotionValue(levelOf(share))
  const counter = useTransform(level, (next) => -next)
  const amplitude = useMotionValue(held ? SLOSH_SCALE : 1)
  const tilt = useMotionValue(held ? SLOSH_TILT : 0)
  const drift = useMotionValue(0)
  const shown = useRef({ share, slosh })
  // What is drawn stays in a sane range whatever the springs do.
  const rotate = useTransform(tilt, (t) => Math.max(-MAX_TILT, Math.min(MAX_TILT, t)))
  const scaleY = useTransform(amplitude, (a) => Math.max(0.6, Math.min(SLOSH_SCALE * 1.3, a)))

  useEffect(() => {
    if (still) { level.set(levelOf(share)); amplitude.set(1); tilt.set(0); return }
    if (shown.current.share === share && shown.current.slosh === slosh) return
    shown.current = { share, slosh }
    // jump, not set: a set reads as an instant move and hands the next spring a huge velocity.
    amplitude.jump(SLOSH_SCALE)
    tilt.jump(SLOSH_TILT)
    drift.jump(-84)
    const running = [animate(level, levelOf(share), SETTLE), animate(amplitude, slosh ? SLOSH_SCALE : 1, SETTLE), animate(tilt, slosh ? SLOSH_TILT : 0, SWAY), animate(drift, 0, DRIFT)]
    return () => running.forEach((run) => run.stop())
  }, [share, still, slosh, level, amplitude, tilt, drift])

  // Follows the device on touch screens. Browsers that want permission simply send nothing.
  useEffect(() => {
    if (still || !window.matchMedia('(pointer: coarse)').matches) return
    const onTilt = (event: DeviceOrientationEvent): void => {
      tilt.set(Math.max(-MAX_DEVICE_TILT, Math.min(MAX_DEVICE_TILT, (event.gamma ?? 0) * DEVICE_TILT_SHARE)))
    }
    window.addEventListener('deviceorientation', onTilt)
    return () => window.removeEventListener('deviceorientation', onTilt)
  }, [still, tilt])

  // The pointer tips the liquid toward it and lets it settle when it leaves; a press splashes it.
  const lean = (e: PointerEvent<HTMLDivElement>): void => {
    if (still || slosh || e.pointerType !== 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    const across = ((e.clientX - box.left) / box.width - 0.5) * 2
    void animate(tilt, -across * POINTER_TILT, { type: 'spring', stiffness: 160, damping: 14 })
  }
  const settle = (): void => { if (!still && !slosh) void animate(tilt, 0, SWAY) }
  const splash = (e: PointerEvent<HTMLDivElement>): void => {
    if (still || slosh) return
    const box = e.currentTarget.getBoundingClientRect()
    const side = (e.clientX - box.left) / box.width < 0.5 ? 1 : -1
    // Each press starts from rest, so quick presses never stack velocity into the springs.
    amplitude.jump(SLOSH_SCALE * 1.2)
    tilt.jump(side * POINTER_TILT)
    drift.jump(side * 60)
    void animate(amplitude, 1, SETTLE)
    void animate(tilt, 0, SPLASH)
    void animate(drift, 0, DRIFT)
  }

  const readout = (
    <>
      <CountUp className={styles.percent} value={value} from={value} format={percent} duration={1.2} still={still} />
      <span className={styles.free}>{free}</span>
    </>
  )

  return (
    <Card
      aria-label={label}
      className={cx(styles.gaugeCard, className)}
      footerClassName={styles.footer}
      animated={animated}
      footer={<Button size="sm" variant={full ? 'primary' : 'secondary'} animated={animated} onClick={onAction}>{full ? urgentActionLabel : actionLabel}</Button>}
    >
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.tile}>{icon ?? <HardDriveIcon size={14} />}</span>
          <h3 className={styles.title}>{label}</h3>
        </div>
        <Badge size="sm" tone={full ? 'warning' : 'success'} animated={animated}>{full ? 'Almost full' : 'Healthy'}</Badge>
      </div>
      <div className={styles.gauge} data-live={still ? undefined : ''} onPointerMove={lean} onPointerLeave={settle} onPointerDown={splash} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)} aria-valuetext={`${percent(value)}, ${free}`} data-full={full ? '' : undefined}>
        <div className={styles.readout} aria-hidden="true">{readout}</div>
        <motion.div className={styles.level} style={{ y: level }}>
          <motion.svg className={styles.waveBack} viewBox="0 0 504 160" aria-hidden="true" style={{ rotate, scaleY, x: drift }}><path d={WAVE} /></motion.svg>
          <motion.svg className={styles.wave} viewBox="0 0 504 160" aria-hidden="true" style={{ rotate, scaleY, x: drift }}><path d={WAVE} /></motion.svg>
          <div className={styles.clip}>
            <div className={styles.fill} />
            <motion.div className={styles.readoutOn} aria-hidden="true" style={{ y: counter }}>{readout}</motion.div>
          </div>
        </motion.div>
      </div>
      <p className={styles.spoken} aria-live="polite">{`${percent(value)} used, ${free}`}</p>
      <dl className={styles.stats}>
        <div className={styles.stat}><dt>Used</dt><dd>{used.toFixed(1)} {unit}</dd></div>
        <div className={styles.stat} data-end=""><dt>Total</dt><dd>{total} {unit}</dd></div>
      </dl>
    </Card>
  )
}
