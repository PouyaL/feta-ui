'use client'
import { animate, motion, useMotionTemplate, useMotionValue, useTransform } from 'motion/react'
import { useRef, useState, type CSSProperties } from 'react'
import { BulbIcon } from '@fetaui/react/rounded/bulb'
import { spring } from '../../motion-tokens'
import { cx, kit, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './pull-chain-light.module.css'

const SWITCH_AT = 22
const REACH = 46
const CORD_X = 179
const CORD_TOP = 121
const CORD_END = 180
/** The tug when the switch is used without a drag: Space, or a tap. */
const TUG = 30
const TILT_PER_PX = 0.03
const SWING_KICK = 90
const SWAY_KICK = 11

/** Dust in the light. Fixed values, so the server and browser render the same scene. */
const MOTES = Array.from({ length: 16 }, (_, i) => ({
  left: 58 + ((i * 37) % 164),
  top: 134 + ((i * 53) % 96),
  size: 2 + (i % 3),
  time: 5 + ((i * 7) % 6),
  delay: -i * 1.3,
  dx: ((i * 29) % 36) - 18,
  dy: -(18 + ((i * 11) % 26)),
  glow: 0.2 + ((i * 5) % 5) / 20,
}))

export type PullChainLightProps = {
  title?: string
  on?: boolean | undefined
  defaultOn?: boolean
  onChange?: (on: boolean) => void
  disabled?: boolean
  /** `false` flips the switch without the cord moving. */
  animated?: boolean
  className?: string
}

/** A pendant lamp you switch by tugging its pull chain. Space toggles it from the keyboard. */
export function PullChainLight({ title = 'Desk lamp', on, defaultOn = false, onChange, disabled, animated = true, className }: PullChainLightProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultOn)
  const [pulling, setPulling] = useState(false)
  /** Set by a drag, so the click that ends it does not switch twice. */
  const dragged = useRef(false)
  const lit = on ?? held
  const y = useMotionValue(0)
  const swing = useMotionValue(0)
  const sway = useMotionValue(0)
  const tilt = useTransform(() => y.get() * TILT_PER_PX + sway.get())
  const end = useTransform(y, (value) => CORD_END + value)
  const endX = useTransform(swing, (value) => CORD_X + value)
  const mid = useTransform(y, (value) => CORD_TOP + (CORD_END + value - CORD_TOP) / 2)
  const bow = useTransform(swing, (value) => CORD_X + value * 0.45)
  const cord = useMotionTemplate`M${CORD_X} ${CORD_TOP} Q${bow} ${mid} ${endX} ${end}`
  // The pull hangs off the lamp, so the lamp's tilt carries it sideways too.
  const pullX = useTransform(() => swing.get() - (CORD_END + y.get()) * Math.sin((tilt.get() * Math.PI) / 180))

  function flip(): void {
    setHeld(!lit)
    onChange?.(!lit)
  }

  /** The cord snaps back with a bounce, the pull swings and the lamp sways on its wire. */
  function recoil(): void {
    animate(y, 0, spring['cord-recoil'])
    animate(swing, 0, { ...spring['cord-sway'], velocity: SWING_KICK })
    animate(sway, 0, { ...spring['lamp-sway'], velocity: SWAY_KICK })
  }

  function letGo(): void {
    setPulling(false)
    if (y.get() >= SWITCH_AT) flip()
    recoil()
  }

  function tug(): void {
    if (still) { flip(); return }
    void animate(y, TUG, { duration: 0.12, ease: 'easeOut' }).then(() => { flip(); recoil() })
  }

  const label = lit ? 'Lights on' : 'Lights off'
  const hint = pulling ? 'Release to switch' : lit ? 'Pull again to turn off' : 'Space also works'

  return (
    <section aria-label={title} data-on={lit ? '' : undefined} data-still={still ? '' : undefined} className={cx(kit.tray, styles.tray, className)}>
      <div className={kit.trayHeader}>
        <span className={kit.trayTitle}><span className={kit.icon}><BulbIcon /></span>{title}</span>
        <span className={styles.status}>{lit ? 'On' : 'Off'}</span>
      </div>
      <div className={cx(kit.card, styles.scene)}>
        <span className={styles.light} aria-hidden="true" />
        <span ref={watchOffscreen} className={styles.dust} data-loop="" aria-hidden="true">
          {MOTES.map((mote) => (
            <span
              key={`${mote.left}-${mote.top}`}
              className={styles.mote}
              style={{
                left: mote.left, top: mote.top, width: mote.size, height: mote.size,
                animationDuration: `${mote.time}s`, animationDelay: `${mote.delay}s`,
                '--dx': `${mote.dx}px`, '--dy': `${mote.dy}px`, '--glow': mote.glow,
              } as CSSProperties}
            />
          ))}
        </span>
        <svg className={styles.lamp} width="280" height="232" viewBox="0 0 280 232" aria-hidden="true">
          <motion.g style={{ rotate: tilt, transformOrigin: '140px 0px' }}>
            <rect className={styles.wire} x="139" y="0" width="2" height="58" />
            <motion.path className={styles.cord} d={cord} />
            <path className={styles.shade} d="M78 121C84 76 112 56 140 56s56 20 62 65z" />
            <path className={styles.highlight} d="M104 88c8-14 20-20 34-22" />
            <ellipse className={styles.underside} cx="140" cy="117" rx="50" ry="6" />
          </motion.g>
        </svg>
        <motion.button
          type="button"
          role="switch"
          aria-checked={lit}
          aria-label={title}
          disabled={disabled}
          className={styles.pull}
          style={{ x: pullX, y }}
          {...(still || disabled ? {} : { drag: 'y' as const, dragConstraints: { top: 0, bottom: REACH }, dragElastic: 0.12, dragMomentum: false, onDragStart: () => { dragged.current = true; setPulling(true) }, onDragEnd: letGo })}
          onClick={() => { if (dragged.current) { dragged.current = false; return } tug() }}
        >
          <span className={styles.bead} />
          <svg width="23" height="18" viewBox="0 0 23 18" aria-hidden="true"><path d="M9 0h5l9 18H0z" /></svg>
        </motion.button>
        <span className={styles.caption} role="status">
          <span className={styles.captionTitle}>{label}</span>
          <span className={kit.meta}>{hint}</span>
        </span>
      </div>
    </section>
  )
}
