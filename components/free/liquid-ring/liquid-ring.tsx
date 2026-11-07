'use client'
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUp02Icon } from '@fetaui/react/rounded/arrow-up-02'
import { AudioLinesIcon } from '@fetaui/react/rounded/audio-lines'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { MicIcon } from '@fetaui/react/rounded/mic'
import { PauseIcon } from '@fetaui/react/rounded/pause'
import { PlayIcon } from '@fetaui/react/rounded/play'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { StopIcon } from '@fetaui/react/rounded/stop'
import { Button } from '../button/button'
import { useDismiss } from '../form-kit/use-dismiss'
import { IconButton } from '../icon-button/icon-button'
import { MetalRing } from '../metal-frame/metal-ring'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './liquid-ring.module.css'

/** Reduced motion and `animated={false}` hold the beam here. */
const STILL_BEAM = 0.6
/** The box radius, which the chrome ring follows. */
const BOX_RADIUS = 24
/** The send button's own small ring: half its 36 px height. */
const SEND_RADIUS = 18
/** The send ring is a touch dimmer than the box ring, as on the old composer. */
const SEND_STRENGTH = 0.9
/** Droplets leave the plus one after another, 40 ms apart, and fold back last out first. */
const FAN_STAGGER_MS = 40
/** The voice clock ticks once a second. */
const TICK_MS = 1000

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

export type LiquidRingAction = {
  id: string
  /** The accessible name, also shown as a tip on hover and focus. */
  label: string
  icon: ReactNode
  disabled?: boolean
}

export type LiquidRingProps = {
  label: string
  placeholder?: string
  defaultValue?: string
  /** `voice` draws a beam along the bottom, `loading` runs one bright arc. */
  state?: 'rest' | 'voice' | 'loading'
  /** The beam in ink, not colour. */
  voiceColorVariant?: 'color' | 'mono'
  /** 0 to 1. The beam's width and glow follow it. */
  voiceLevel?: number
  /** 0 to 1. How bright and solid the chrome ring and its glow are. Default 1. */
  metalStrength?: number
  /** Beside the send button, like the model name. */
  model?: ReactNode
  hint?: ReactNode
  onSubmit?: (value: string) => void
  onStop?: () => void
  onVoice?: () => void
  /** The plus at the start of the footer. */
  onAttach?: () => void
  /** Opens your model menu. */
  onModel?: () => void
  /** Actions the plus splits out like droplets. Left out, the plus calls `onAttach`. */
  actions?: LiquidRingAction[]
  onAction?: (id: string) => void
  /** Pauses the voice clock and dims the beam, when controlled. */
  voicePaused?: boolean
  defaultVoicePaused?: boolean
  onVoicePauseChange?: (paused: boolean) => void
  animated?: boolean
  className?: string
}

/** Wraps the Prompt Input composer in a liquid metal ring with an orbiting glow and a voice beam. */
export function LiquidRing({ label, placeholder = 'Ask the agent to do something…', defaultValue = '', state = 'rest', voiceColorVariant = 'color', voiceLevel = 0.6, metalStrength = 1, model, hint, onSubmit, onStop, onVoice, onAttach, onModel, actions = [], onAction, voicePaused, defaultVoicePaused = false, onVoicePauseChange, animated = true, className }: LiquidRingProps) {
  const still = useStill(animated)
  const [value, setValue] = useState(defaultValue)
  const [fanOpen, setFanOpen] = useState(false)
  const [heldPaused, setHeldPaused] = useState(defaultVoicePaused)
  const voice = state === 'voice'
  const paused = voice && (voicePaused ?? heldPaused)

  const togglePause = (): void => {
    const next = !paused
    setHeldPaused(next)
    onVoicePauseChange?.(next)
  }
  const filled = value.trim().length > 0
  const strength = Math.max(0, Math.min(1, metalStrength))

  // Send submits, voice included; only a running response turns it into Stop. Voice ends from its own button.
  function send(): void {
    if (state === 'loading') onStop?.()
    else if (state === 'voice' || filled) onSubmit?.(value)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  function onFormKey(e: KeyboardEvent<HTMLFormElement>): void {
    if (e.key === 'Escape' && state === 'loading' && onStop) {
      e.preventDefault()
      onStop()
    }
  }

  const beam = still ? STILL_BEAM : Math.max(0.2, Math.min(1, voiceLevel))
  const hasFan = actions.length > 0
  const sendLit = state === 'loading' || state === 'voice' || filled

  return (
    <form
      className={cx(styles.ring, className)}
      data-state={state}
      data-mono={voiceColorVariant === 'mono' ? '' : undefined}
      data-paused={paused ? '' : undefined}
      data-fan-open={fanOpen ? '' : undefined}
      data-still={still ? '' : undefined}
      data-loop=""
      style={{ '--strength': strength, '--beam': beam } as CSSProperties}
      onKeyDown={onFormKey}
      onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); send() }}
    >
      <div className={styles.frame}>
        {/* A soft light circling outside the box, masked to the spill past the ring. */}
        <span ref={watchOffscreen} aria-hidden="true" className={styles.orbit}><span className={styles.orbitClip}><span className={styles.orbitTurn} /></span></span>
        {state === 'voice' ? (
          <span aria-hidden="true" className={styles.blooms}><span className={styles.pink} /><span className={styles.blue} /></span>
        ) : null}
        <div className={styles.box}>
          <div className={styles.field}>
            {state === 'voice' ? <span aria-hidden="true" className={styles.lead}><AudioLinesIcon /></span> : null}
            <textarea rows={2} aria-label={label} className={styles.input} placeholder={placeholder} value={state === 'voice' ? 'Listening…' : value} readOnly={state === 'voice'} onChange={(e) => setValue(e.target.value)} onKeyDown={onKeyDown} />
          </div>
          <div className={styles.footer}>
            <div className={styles.side}>
              {hasFan
                ? <ActionsFan actions={actions} open={fanOpen} onOpenChange={setFanOpen} onAction={onAction} still={still} animated={animated} disabled={state === 'loading'} />
                : <IconButton variant="secondary" size="md" icon={<PlusIcon />} label="Add" animated={animated} onClick={onAttach} />}
              {model ? (
                <span className={styles.model} data-hidden={fanOpen ? '' : undefined} inert={fanOpen}>
                  <Button variant="ghost" shape="pill" size="sm" animated={animated} leadingIcon={<SparklesIcon />} trailingIcon={<span className={styles.down}><ChevronUpIcon /></span>} onClick={onModel}>{model}</Button>
                </span>
              ) : null}
            </div>
            <div className={styles.side}>
              {voice ? (
                <>
                  <VoiceClock paused={paused} />
                  <IconButton variant="ghost" size="md" icon={paused ? <PlayIcon /> : <PauseIcon />} label={paused ? 'Resume voice' : 'Pause voice'} aria-pressed={paused} animated={animated} onClick={togglePause} />
                  <IconButton variant="primary" size="md" icon={<AudioLinesIcon />} label="Stop listening" animated={animated} onClick={onStop} />
                </>
              ) : (
                <span className={styles.mic}><IconButton variant="ghost" size="md" icon={<MicIcon />} label="Voice" animated={animated} onClick={onVoice} /></span>
              )}
              <span className={styles.send} data-lit={sendLit ? '' : undefined}>
                <IconButton type="submit" variant={state === 'voice' ? 'secondary' : 'primary'} size="md" disabled={state === 'rest' && !filled} icon={state === 'loading' ? <StopIcon /> : <ArrowUp02Icon />} label={state === 'loading' ? 'Stop' : 'Send'} animated={animated} />
                <MetalRing borderRadius={SEND_RADIUS} strength={SEND_STRENGTH * strength} bend={false} still={still} />
              </span>
            </div>
          </div>
        </div>
        <MetalRing borderRadius={BOX_RADIUS} strength={strength} speed={state === 'loading' ? 2 : 1} still={still} />
        <span aria-hidden="true" className={styles.lit}><span className={styles.arc} /></span>
        {state === 'voice' ? (
          <span aria-hidden="true" className={styles.beam}>
            <span className={styles.beamGlow} />
            <span className={styles.beamLine} />
          </span>
        ) : null}
      </div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </form>
  )
}

/**
 * The voice clock, on its own so only it re-renders each second. It mounts with voice, so it starts at 0:00
 * and resets when voice ends. It counts while not paused, also with motion off.
 */
function VoiceClock({ paused }: { paused: boolean }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setElapsed((s) => s + 1), TICK_MS)
    return () => clearInterval(timer)
  }, [paused])
  return <span role="timer" aria-live="off" aria-label={`${paused ? 'Voice paused' : 'Listening'} ${clock(elapsed)}`} className={styles.timer}>{paused ? 'Paused' : 'Listening'} {clock(elapsed)}</span>
}

type FanProps = {
  actions: LiquidRingAction[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: ((id: string) => void) | undefined
  still: boolean
  animated: boolean
  disabled: boolean
}

/**
 * The plus and its actions as one liquid: opening pulls the actions out of the plus as droplets that stay
 * joined for a moment as they part, and closing melts them back. The droplets are blobs under an SVG goo
 * filter; the buttons sit on top, crisp. Left and Right move between the plus and the actions, Esc closes,
 * and Tab leaves the group in one step because only the plus is in the tab order.
 */
function ActionsFan({ actions, open, onOpenChange, onAction, still, animated, disabled }: FanProps) {
  const group = useRef<HTMLDivElement>(null)
  const uid = useId()
  const filter = `goo-${uid.replace(/[^a-zA-Z0-9-]/g, '')}`
  const trigger = (): HTMLButtonElement | null => group.current?.querySelector<HTMLButtonElement>('[data-fan-trigger] button') ?? null
  const close = useCallback((refocus: boolean): void => {
    onOpenChange(false)
    if (refocus) trigger()?.focus()
  }, [onOpenChange])
  const dismiss = useCallback(() => close(false), [close])
  useDismiss(group, open, dismiss)
  useEffect(() => { if (disabled && open) onOpenChange(false) }, [disabled, open, onOpenChange])

  function onKey(e: KeyboardEvent<HTMLDivElement>): void {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      close(true)
      return
    }
    if (!open || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End')) return
    const stops = [...(group.current?.querySelectorAll<HTMLButtonElement>('[data-fan-stop] button:not(:disabled)') ?? [])]
    const at = stops.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? stops.length - 1 : (at + (e.key === 'ArrowRight' ? 1 : -1) + stops.length) % stops.length
    e.preventDefault()
    stops[next]?.focus()
  }

  // Tabbing out closes the fan, so focus is never held inside it.
  function onBlur(e: FocusEvent<HTMLDivElement>): void {
    if (open && !(e.relatedTarget instanceof Node && group.current?.contains(e.relatedTarget))) onOpenChange(false)
  }

  const delay = (i: number): CSSProperties => ({ '--i': i, transitionDelay: still ? '0ms' : `${(open ? i : actions.length - 1 - i) * FAN_STAGGER_MS}ms` } as CSSProperties)

  return (
    <div ref={group} role="group" aria-label="Add to prompt" className={styles.fan} data-open={open ? '' : undefined} onKeyDown={onKey} onBlur={onBlur}>
      <svg aria-hidden="true" className={styles.gooDefs} width="0" height="0">
        <filter id={filter}>
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="soft" />
          <feColorMatrix in="soft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" />
        </filter>
      </svg>
      <span aria-hidden="true" className={styles.goo} style={{ filter: `url(#${filter})` }}>
        <span className={styles.drop} />
        {actions.map((action, i) => <span key={action.id} className={cx(styles.drop, styles.travel)} style={delay(i)} />)}
      </span>
      <span className={styles.plus} data-fan-trigger="" data-fan-stop="">
        <IconButton variant="ghost" size="md" icon={<PlusIcon />} label={open ? 'Close add menu' : 'Add to prompt'} aria-expanded={open} disabled={disabled} animated={animated} onClick={() => onOpenChange(!open)} />
      </span>
      {actions.map((action, i) => (
        <span key={action.id} className={cx(styles.action, styles.travel)} style={delay(i)} data-fan-stop="" inert={!open}>
          <IconButton variant="ghost" size="md" icon={action.icon} label={action.label} tabIndex={-1} disabled={action.disabled ?? false} animated={animated} onClick={() => { onAction?.(action.id); close(true) }} />
          <span aria-hidden="true" className={styles.tip}>{action.label}</span>
        </span>
      ))}
    </div>
  )
}
