'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useState, type Ref } from 'react'
import { CallEndIcon } from '@fetaui/react/rounded/call-end'
import { CaptionsIcon } from '@fetaui/react/rounded/captions'
import { MicIcon } from '@fetaui/react/rounded/mic'
import { MicOffIcon } from '@fetaui/react/rounded/mic-off'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { StopIcon } from '@fetaui/react/rounded/stop'
import { cx, kit, pressProps, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './voice-control.module.css'

export type VoiceControlKind = 'mic' | 'listening' | 'muted' | 'captions' | 'captions-on' | 'stop' | 'end' | 'more'

const LABEL: Record<VoiceControlKind, string> = {
  mic: 'Start talking', listening: 'Stop listening', muted: 'Unmute', captions: 'Turn captions on', 'captions-on': 'Turn captions off', stop: 'Stop', end: 'End call', more: 'More',
}

const ICON = {
  mic: MicIcon, muted: MicOffIcon, captions: CaptionsIcon, 'captions-on': CaptionsIcon, stop: StopIcon, end: CallEndIcon, more: MoreHorizontalIcon,
} as const

const LEVELS = [8, 14, 10, 16, 8]
const WAVE = [4, 8, 14, 10, 18, 12, 16, 8, 4]

export type VoiceControlProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref'> & {
  control?: VoiceControlKind
  /** Defaults to a label for the control. */
  label?: string
  /** Bar heights in px for a real level meter. Leave it out for the idle loop. */
  levels?: number[]
  /** `false` turns off the press scale, the halo and the idle bars. Real `levels` still move: they carry information. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** Round controls for voice and call surfaces. */
export function VoiceControl({ control = 'mic', label, levels, animated = true, className, disabled, type = 'button', ref, ...rest }: VoiceControlProps) {
  const still = useStill(animated)
  const toggle = control === 'captions' || control === 'captions-on' || control === 'muted'
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={label ?? LABEL[control]}
      aria-pressed={toggle ? control !== 'captions' : undefined}
      data-control={control}
      data-loop={control === 'listening' ? '' : undefined}
      data-still={still ? '' : undefined}
      className={cx(kit.control, styles.control, className)}
      {...pressProps(still, disabled)}
      {...rest}
    >
      {control === 'listening' ? (
        <>
          <span className={styles.halo} aria-hidden="true" />
          <span ref={watchOffscreen} className={styles.level} aria-hidden="true">
            {LEVELS.map((height, i) => <span key={i} className={styles.bar} data-live={levels ? undefined : ''} style={{ height: levels?.[i] ?? height }} />)}
          </span>
        </>
      ) : (() => {
        const Icon = ICON[control]
        return <Icon />
      })()}
    </motion.button>
  )
}

export type VoiceBarProps = {
  state?: 'idle' | 'listening' | 'muted' | undefined
  defaultState?: 'idle' | 'listening' | 'muted'
  onStateChange?: (state: 'idle' | 'listening' | 'muted') => void
  /** Second line. Defaults to `agent` while idle, then the time since the call started. */
  meta?: string
  /** Who answers, shown while idle. Default Assistant. */
  agent?: string
  onEnd?: () => void
  onMore?: () => void
  animated?: boolean
  className?: string
}

/** The composed voice bar: status, timer, live wave and call controls. */
export function VoiceBar({ state, defaultState = 'idle', onStateChange, meta, agent = 'Assistant', onEnd, onMore, animated = true, className }: VoiceBarProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultState)
  const [captions, setCaptions] = useState(false)
  const current = state ?? held
  const live = current !== 'idle'
  const [elapsed, setElapsed] = useState(0)

  // The call clock runs from the first tap until the bar returns to idle.
  useEffect(() => {
    if (!live) { setElapsed(0); return }
    const start = Date.now()
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(tick)
  }, [live])

  function step(): void {
    const next = current === 'idle' ? 'listening' : current === 'listening' ? 'muted' : 'listening'
    setHeld(next)
    onStateChange?.(next)
  }

  const status = current === 'idle' ? 'Tap to talk' : current === 'listening' ? 'Listening' : 'Muted'
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`
  const second = meta ?? (live ? clock : agent)

  return (
    <div role="group" aria-label="Voice" className={cx(kit.tray, styles.barTray, className)}>
      <div className={cx(kit.card, styles.bar2)}>
        <VoiceControl control={current === 'idle' ? 'mic' : current} animated={animated} onClick={step} />
        <span className={styles.meta}>
          <span className={styles.status} role="status">{status}</span>
          <span className={kit.meta}>{second}</span>
        </span>
        <span ref={current === 'listening' ? watchOffscreen : undefined} className={styles.wave} data-loop="" data-state={current} data-still={still ? '' : undefined} aria-hidden="true">
          {WAVE.map((height, i) => <span key={i} style={{ height: current === 'listening' ? height : 4 }} />)}
        </span>
        <span className={styles.controls}>
          <VoiceControl control={captions ? 'captions-on' : 'captions'} animated={animated} onClick={() => setCaptions(!captions)} />
          <VoiceControl control="more" animated={animated} onClick={onMore} />
          <VoiceControl control="end" animated={animated} onClick={onEnd} />
        </span>
      </div>
    </div>
  )
}
