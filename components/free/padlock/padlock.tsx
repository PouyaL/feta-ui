'use client'
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform, type AnimationPlaybackControls } from 'motion/react'
import { useCallback, useEffect, useId, useRef } from 'react'
import { duration, ease, spring } from '../../motion-tokens'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './padlock.module.css'

export type PadlockStatus = 'locked' | 'checking' | 'open' | 'error'

export type PadlockProps = {
  status?: PadlockStatus
  /** Width in px. Height follows at 180 by 214. */
  width?: number
  /** Names the picture. Without it the lock is decorative. */
  'aria-label'?: string
  /** Announces each change of status in a polite live region. Leave off when the page already says it. */
  announce?: boolean
  /** The words announced for each status. */
  labels?: Partial<Record<PadlockStatus, string>>
  animated?: boolean
  className?: string
}

const LABELS: Record<PadlockStatus, string> = { locked: 'Locked', checking: 'Checking', open: 'Unlocked', error: 'Could not unlock' }

// Shackle lift per status, from the Figma variants: Checking 10, Open 28.
const LIFT: Record<PadlockStatus, number> = { locked: 0, checking: -10, open: -28, error: 0 }
// Open frees the right leg: its tip clears the body by 42, so the leg shortens by 34 as the shackle climbs from 10 to 28.
const LEG_FREE = 34
// Code only motion values, named for promotion to tokens.
const OPEN_TILT = -4 // degrees the shackle swings about the left leg as it pops
const OPEN_TILT_S = 0.56
const BODY_GIVE = 2.5 // px the body gives as the shackle pops or lands
const BODY_GIVE_S = 0.3
const LAND_DELAY_S = 0.1
const ERROR_TUG = -6 // px the shackle tries to lift before it holds
const ERROR_TUG_S = 0.22
const SHAKE = [0, -6, 5, -4, 3, -1.5, 0]
const SHAKE_DELAY_S = 0.12
const FADE_S = 0.2

const RINGS = [[81, 140], [99, 140], [99, 158], [81, 158]] as const
/** Drawing units as a percent of the 180 wide, 214 tall box. */
const toWidth = (v: number): number => v / 1.8
const toHeight = (v: number): number => v / 2.14
/** The shackle swings about its left leg at 46, 92. */
const ORIGIN = `${toWidth(46)}% ${toHeight(92)}%`
const BODY = { x: 22, y: 92, width: 136, height: 114, rx: 26 } as const

/** A gunmetal padlock. Its metal is fixed on purpose so it reads the same in Light and Dark; the emblem takes status color. */
export function Padlock({ status = 'locked', width = 180, 'aria-label': label, announce = false, labels, animated = true, className }: PadlockProps) {
  const still = useStill(animated)
  // Reduced motion keeps state changes as fades. `animated={false}` keeps everything still.
  const reduce = useReducedMotion()
  const fade = still && animated && Boolean(reduce)
  const raw = useId()
  const id = `pl${raw.replace(/[^a-zA-Z0-9]/g, '')}`
  const url = (name: string) => `url(#${id}-${name})`

  // Motion values only: no React state changes per frame.
  const y = useMotionValue(LIFT[status])
  const tilt = useMotionValue(0)
  const shown = useMotionValue(1)
  const give = useMotionValue(0)
  const shake = useMotionValue(0)
  const free = useTransform(y, [LIFT.checking, LIFT.open], [0, LEG_FREE], { clamp: true })
  const legNear = useTransform(free, (v) => -v / 2)
  const legFar = useTransform(free, (v) => -v)
  // The layers move as boxes, so the 180 by 214 drawing units become shares of the box. Then any width, or a max-width squeeze, scales the motion too.
  const liftY = useTransform(y, toHeight)
  const shakeX = useTransform(shake, (v) => `${toWidth(v)}%`)
  const giveY = useTransform(give, (v) => `${toHeight(v)}%`)
  // One template for the shackle, so a re-render mid swing can never drop the tilt.
  const lift = useMotionTemplate`translateY(${liftY}%) rotate(${tilt}deg)`

  // The checking glint pauses offscreen.
  const watch = useCallback((node: HTMLSpanElement | null) => (node ? watchOffscreen(node) : undefined), [])

  // Each change of status plays its beats once, from wherever the last one left off.
  const last = useRef(status)
  useEffect(() => {
    const from = last.current
    last.current = status
    if (from === status) return
    const target = LIFT[status]
    if (still) {
      tilt.set(0); give.set(0); shake.set(0)
      if (!fade) { y.set(target); return }
      // Fade out, move while hidden, fade back.
      const runs = [animate(shown, [1, 0, 1], { duration: FADE_S, ease: 'linear' }), animate(y, target, { duration: 0, delay: FADE_S / 2 })]
      return () => runs.forEach((run) => run.stop())
    }
    shown.set(1)
    const runs: AnimationPlaybackControls[] = []
    if (status === 'open') {
      runs.push(animate(y, target, spring.stamp))
      runs.push(animate(tilt, [0, OPEN_TILT, 0], { duration: OPEN_TILT_S, times: [0, 0.35, 1], ease: ease['out-soft'] }))
      runs.push(animate(give, [0, BODY_GIVE, 0], { duration: BODY_GIVE_S, times: [0, 0.3, 1], ease: ease.out, delay: 0.04 }))
    } else if (status === 'checking') {
      runs.push(animate(y, target, spring.press))
    } else if (status === 'locked') {
      runs.push(animate(y, target, spring.snap))
      tilt.set(0)
      // The shackle lands with a click the body takes.
      if (from === 'open' || from === 'checking') {
        runs.push(animate(give, [0, from === 'open' ? BODY_GIVE : BODY_GIVE / 2, 0], { duration: BODY_GIVE_S, times: [0, 0.3, 1], ease: ease.out, delay: LAND_DELAY_S }))
      }
    } else {
      tilt.set(0)
      // From rest the shackle tugs and holds; from a lift it drops straight back. Then the lock shakes once.
      runs.push(from === 'locked'
        ? animate(y, [y.get(), ERROR_TUG, 0], { duration: ERROR_TUG_S, times: [0, 0.4, 1], ease: ease.out })
        : animate(y, target, spring.snap))
      runs.push(animate(shake, SHAKE, { duration: duration.shake, ease: ease.out, delay: SHAKE_DELAY_S }))
    }
    return () => runs.forEach((run) => run.stop())
  }, [status, still, fade, y, tilt, shown, give, shake])

  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  // Every layer draws in the same 180 by 214 space and fills the box.
  const layer = { viewBox: '0 0 180 214', className: styles.layer, 'aria-hidden': true, focusable: 'false' } as const

  const lock = (
    <span
      ref={watch}
      {...a11y}
      className={cx(styles.lock, className)}
      style={{ width }}
      data-status={status}
      data-still={still ? '' : undefined}
      data-fade={fade ? '' : undefined}
      // Always marked, so the shared observer can flag it before the glint starts.
      data-loop=""
      data-glint={status === 'checking' && !still ? '' : undefined}
    >
      {/* Stacked layers, so the shackle, the body and the shake move as whole layers and the filters inside never redraw while they move. */}
      <svg {...layer}>
        <defs>
          {/* Chrome runs across the shackle's stroke bounds in user space, so the freed leg segments match the leg exactly. */}
          <linearGradient id={`${id}-steel`} gradientUnits="userSpaceOnUse" x1="37.5" y1="0" x2="142.5" y2="0">
            <stop offset="0" className={styles.steel0} />
            <stop offset=".18" className={styles.steel1} />
            <stop offset=".30" className={styles.steel2} />
            <stop offset=".42" className={styles.steel3} />
            <stop offset=".62" className={styles.steel4} />
            <stop offset=".82" className={styles.steel5} />
            <stop offset="1" className={styles.steel6} />
          </linearGradient>
          <linearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.body0} />
            <stop offset=".22" className={styles.body1} />
            <stop offset=".70" className={styles.body2} />
            <stop offset="1" className={styles.body3} />
          </linearGradient>
          <radialGradient id={`${id}-sheen`} gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1" gradientTransform="translate(104.6 136) scale(48.6 25.9)">
            <stop offset="0" className={styles.sheen0} />
            <stop offset="1" className={styles.sheen1} />
          </radialGradient>
          <linearGradient id={`${id}-glint`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className={styles.sheen1} />
            <stop offset=".5" className={styles.glint} />
            <stop offset="1" className={styles.sheen1} />
          </linearGradient>
          <clipPath id={`${id}-face`}><rect {...BODY} /></clipPath>
          <filter colorInterpolationFilters="sRGB" id={`${id}-floor`} x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="5" /></filter>
          <filter colorInterpolationFilters="sRGB" id={`${id}-soft`} x="-50%" y="-100%" width="200%" height="300%"><feGaussianBlur stdDeviation="1" /></filter>
          <filter colorInterpolationFilters="sRGB" id={`${id}-hair`} x="-50%" y="-10%" width="200%" height="120%"><feGaussianBlur stdDeviation=".5" /></filter>
          <filter colorInterpolationFilters="sRGB" id={`${id}-lift`} x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="4" className={styles.shadeFlood} floodOpacity=".35" /></filter>
          <filter colorInterpolationFilters="sRGB" id={`${id}-cast`} x="-60%" y="-40%" width="220%" height="220%">
            <feDropShadow dx="0" dy="26" stdDeviation="20" className={styles.shadeFlood} floodOpacity=".38" result="far" />
            <feDropShadow in="SourceAlpha" dx="0" dy="8" stdDeviation="7" className={styles.shadeFlood} floodOpacity=".22" result="near" />
            <feMerge><feMergeNode in="far" /><feMergeNode in="near" /></feMerge>
          </filter>
          {/* Inner light and shade: the top bevel, the lit left edge and the dark foot of the body. */}
          <filter colorInterpolationFilters="sRGB" id={`${id}-bevel`} x="-20%" y="-20%" width="140%" height="140%">
            {/* Figma inner shadows: the outside of the body, offset, blurred, then kept inside the body. */}
            <feFlood floodOpacity="1" result="full" />
            <feComposite in="full" in2="SourceAlpha" operator="out" result="outside" />
            <feOffset in="outside" dy="1.5" result="downOut" />
            <feComposite in="downOut" in2="SourceAlpha" operator="in" result="topEdge" />
            <feFlood className={styles.lightFlood} floodOpacity=".28" />
            <feComposite in2="topEdge" operator="in" result="top" />
            <feOffset in="outside" dx="2" result="rightOut" />
            <feComposite in="rightOut" in2="SourceAlpha" operator="in" result="leftEdge" />
            <feFlood className={styles.lightFlood} floodOpacity=".06" />
            <feComposite in2="leftEdge" operator="in" result="left" />
            <feOffset in="outside" dy="-10" result="upOut" />
            <feGaussianBlur in="upOut" stdDeviation="9" result="upBlur" />
            <feComposite in="upBlur" in2="SourceAlpha" operator="in" result="footEdge" />
            <feFlood className={styles.shadeFlood} floodOpacity=".55" />
            <feComposite in2="footEdge" operator="in" result="foot" />
            <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="foot" /><feMergeNode in="top" /><feMergeNode in="left" /></feMerge>
          </filter>
          <filter colorInterpolationFilters="sRGB" id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feComponentTransfer in="blur" result="halo"><feFuncA type="linear" slope=".8" /></feComponentTransfer>
            <feMerge><feMergeNode in="halo" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* The floor stays put while the lock shakes. */}
        <ellipse className={styles.floor} cx="90" cy="206" rx="70" ry="8" filter={url('floor')} />
      </svg>

      <motion.span className={cx(styles.layers, styles.moving)} style={{ x: shakeX }}>
        <motion.svg {...layer} className={cx(styles.layer, styles.moving)} style={{ transform: lift, opacity: shown, transformOrigin: ORIGIN }}>
          <g filter={url('lift')}>
            <path d="M46 142 V58 C46 30 66 12 90 12 C114 12 134 30 134 58 V78" fill="none" stroke={url('steel')} strokeWidth="17" strokeLinecap="round" />
            {/* The right leg below the stub telescopes into it as the leg comes free. */}
            <motion.path style={{ y: legNear }} d="M134 78 V95" fill="none" stroke={url('steel')} strokeWidth="17" strokeLinecap="round" />
            <motion.path style={{ y: legFar }} d="M134 95 V112" fill="none" stroke={url('steel')} strokeWidth="17" strokeLinecap="round" />
            <path className={styles.specular} d="M41 150 V58 C41 34 56 17 76 14" filter={url('hair')} />
          </g>
        </motion.svg>

        <motion.span className={cx(styles.layers, styles.moving)} style={{ y: giveY }}>
          <svg {...layer}>
            <rect {...BODY} className={styles.castSource} filter={url('cast')} />
            <rect {...BODY} fill={url('body')} filter={url('bevel')} />
            <rect {...BODY} fill={url('sheen')} />
          </svg>
          {/* The glint has its own layer, so its loop never redraws the filtered body under it. */}
          <svg {...layer} className={cx(styles.layer, styles.looping)}>
            <g clipPath={url('face')} className={styles.glintTrack}>
              <rect className={styles.glintBand} x="-36" y="88" width="36" height="122" fill={url('glint')} />
            </g>
          </svg>
          <svg {...layer} className={cx(styles.layer, styles.looping)}>
            <ellipse className={styles.socket} cx="46" cy="97" rx="11" ry="4" filter={url('soft')} />
            <ellipse className={cx(styles.socket, styles.socketClosed)} cx="134" cy="97" rx="11" ry="4" filter={url('soft')} />
            <ellipse className={styles.socketOpen} cx="134" cy="97.5" rx="9.5" ry="3" />

            <g className={styles.engraving} fill="none">
              {RINGS.map(([x, cy]) => <circle key={`l${x}${cy}`} className={styles.ringLight} cx={x} cy={cy + 1} r="12.5" />)}
              {RINGS.map(([x, cy]) => <circle key={`r${x}${cy}`} className={styles.ring} cx={x} cy={cy} r="12.2" />)}
            </g>
            <g className={styles.lit} data-tone="success" fill="none" filter={url('glow')}>
              {RINGS.map(([x, cy]) => <circle key={x * 1000 + cy} className={styles.litRing} cx={x} cy={cy} r="12.2" />)}
            </g>
            <g className={styles.lit} data-tone="danger" fill="none" filter={url('glow')}>
              {RINGS.map(([x, cy]) => <circle key={x * 1000 + cy} className={styles.litRing} cx={x} cy={cy} r="12.2" />)}
            </g>
          </svg>
        </motion.span>
      </motion.span>
    </span>
  )

  if (!announce) return lock
  return (
    <>
      {lock}
      <span className={styles.srOnly} role="status">{labels?.[status] ?? LABELS[status]}</span>
    </>
  )
}
