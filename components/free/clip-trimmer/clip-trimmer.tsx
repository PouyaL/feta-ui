'use client'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { PauseIcon } from '@fetaui/react/rounded/pause'
import { PlayIcon } from '@fetaui/react/rounded/play'
import { RotateCcwIcon } from '@fetaui/react/rounded/rotate-ccw'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './clip-trimmer.module.css'

const FRAMES = 10
const MIN_CLIP_S = 1
const SNAP_PX = 5
const KEY_STEP_S = 0.1
const FAKE_EXPORT_MS = 1600

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`

export type ClipTrimmerProps = {
  /** A still of the clip. Each filmstrip frame shows a slice of it. */
  src: string
  alt: string
  /** Clip length in seconds. */
  duration: number
  defaultStart?: number
  defaultEnd?: number
  onChange?: (range: { start: number; end: number }) => void
  /** Renders the export and reports 0 to 1. Without it, progress is simulated. */
  onExport?: (range: { start: number; end: number }, report: (progress: number) => void) => Promise<void>
  animated?: boolean
  className?: string
}

/** Keep part of a clip. An ink range over a filmstrip, handles that snap to whole seconds. */
export function ClipTrimmer({ src, alt, duration, defaultStart = 0, defaultEnd, onChange, onExport, animated = true, className }: ClipTrimmerProps) {
  const still = useStill(animated)
  const strip = useRef<HTMLDivElement>(null)
  const playhead = useRef<HTMLSpanElement>(null)
  const clip = useRef({ start: defaultStart, end: defaultEnd ?? duration })
  const [range, setRange] = useState({ start: defaultStart, end: defaultEnd ?? duration })
  const [active, setActive] = useState<'start' | 'end' | null>(null)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [failed, setFailed] = useState(false)
  clip.current = range
  const full = range.start === 0 && range.end === duration
  const percent = (seconds: number): string => `${(seconds / duration) * 100}%`

  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    let at = clip.current.start
    const tick = (now: number): void => {
      at += (now - last) / 1000
      last = now
      const { start, end } = clip.current
      if (at >= end) {
        // Reduced motion plays once. Otherwise the clip loops inside the range.
        if (still) { setPlaying(false); return }
        at = start
      }
      if (playhead.current) playhead.current.style.transform = `translateX(${(at / duration) * (strip.current?.clientWidth ?? 0)}px)`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, duration, still])

  function move(edge: 'start' | 'end', seconds: number): void {
    const next = edge === 'start' ? { ...clip.current, start: Math.max(0, Math.min(seconds, clip.current.end - MIN_CLIP_S)) } : { ...clip.current, end: Math.min(duration, Math.max(seconds, clip.current.start + MIN_CLIP_S)) }
    clip.current = next
    setRange(next)
    setFailed(false)
    onChange?.(next)
  }

  function grab(edge: 'start' | 'end', e: PointerEvent<HTMLSpanElement>): void {
    const track = strip.current
    if (!track) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setActive(edge)
    const toSeconds = (x: number): number => {
      const rect = track.getBoundingClientRect()
      const seconds = ((x - rect.left) / rect.width) * duration
      const whole = Math.round(seconds)
      return Math.abs(whole - seconds) * (rect.width / duration) <= SNAP_PX ? whole : seconds
    }
    const target = e.currentTarget
    const onMove = (event: globalThis.PointerEvent): void => move(edge, toSeconds(event.clientX))
    const onUp = (): void => {
      setActive(null)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  function onKey(edge: 'start' | 'end', e: KeyboardEvent<HTMLSpanElement>): void {
    const by = { ArrowRight: KEY_STEP_S, ArrowUp: KEY_STEP_S, ArrowLeft: -KEY_STEP_S, ArrowDown: -KEY_STEP_S, PageUp: 1, PageDown: -1 }[e.key]
    if (by === undefined) return
    e.preventDefault()
    move(edge, Math.round((clip.current[edge] + by) * 10) / 10)
  }

  async function run(): Promise<void> {
    setPlaying(false)
    setExporting(true)
    setFailed(false)
    setProgress(0)
    try {
      if (onExport) await onExport(range, setProgress)
      else {
        const started = performance.now()
        await new Promise<void>((done) => {
          const timer = setInterval(() => {
            const value = Math.min(1, (performance.now() - started) / FAKE_EXPORT_MS)
            setProgress(value)
            if (value >= 1) { clearInterval(timer); done() }
          }, 60)
        })
      }
    } catch {
      setFailed(true)
    } finally {
      setExporting(false)
    }
  }

  const handle = (edge: 'start' | 'end') => (
    <span
      role="slider"
      tabIndex={0}
      aria-label={edge === 'start' ? 'Clip start' : 'Clip end'}
      aria-valuemin={edge === 'start' ? 0 : range.start + MIN_CLIP_S}
      aria-valuemax={edge === 'start' ? range.end - MIN_CLIP_S : duration}
      aria-valuenow={Math.round(range[edge] * 10) / 10}
      aria-valuetext={clock(range[edge])}
      className={styles.handle}
      data-edge={edge}
      data-active={active === edge ? '' : undefined}
      style={{ left: percent(range[edge]) }}
      onPointerDown={(e) => grab(edge, e)}
      onKeyDown={(e) => onKey(edge, e)}
    />
  )

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined}>
      <div className={styles.body}>
        <div className={styles.preview}>
          <img src={src} alt={alt} className={styles.image} draggable={false} />
          <span className={styles.disc}>
            <IconButton variant="ghost" size="md" icon={playing ? <PauseIcon /> : <PlayIcon />} label={playing ? 'Pause' : 'Play'} animated={animated} onClick={() => setPlaying(!playing)} />
          </span>
          <span className={styles.clock} role={failed ? 'alert' : undefined}>{exporting ? `Exporting ${Math.round(progress * 100)}%` : failed ? 'Export failed' : clock(range[active ?? 'start'])}</span>
          {active ? <span className={styles.time} style={{ left: percent(range[active]) }}>{clock(range[active])}</span> : null}
        </div>
        <div ref={strip} className={styles.strip}>
          <div className={styles.frames} aria-hidden="true">{Array.from({ length: FRAMES }, (_, i) => <span key={i} className={styles.frame} style={{ backgroundImage: `url("${src}")`, backgroundPosition: `${(i / (FRAMES - 1)) * 100}% 50%` }} />)}</div>
          <span aria-hidden="true" className={styles.cut} style={{ left: 0, width: percent(range.start) }} />
          <span aria-hidden="true" className={styles.cut} style={{ left: percent(range.end), right: 0 }} />
          <span aria-hidden="true" className={styles.range} style={{ left: percent(range.start), width: percent(range.end - range.start) }}>
            {exporting ? <span className={styles.fill} style={{ transform: `scaleX(${progress})` }} /> : null}
          </span>
          {playing ? <span ref={playhead} aria-hidden="true" className={styles.playhead} /> : null}
          {handle('start')}
          {handle('end')}
        </div>
        <div className={styles.ruler} aria-hidden="true"><span>0s</span><span>{duration / 2}s</span><span>{duration}s</span></div>
      </div>
      <div className={styles.controls}>
        <p className={styles.length} aria-live="polite"><strong>{(range.end - range.start).toFixed(1)}s</strong> of {duration.toFixed(1)}s</p>
        <Button variant="ghost" shape="pill" size="sm" animated={animated} disabled={full || exporting} leadingIcon={<RotateCcwIcon />} onClick={() => { const next = { start: 0, end: duration }; setRange(next); onChange?.(next) }}>Reset</Button>
        <Button shape="pill" size="sm" animated={animated} disabled={full && !exporting} status={exporting ? 'loading' : 'idle'} loadingLabel="Exporting" onClick={() => void run()}>Export</Button>
      </div>
    </div>
  )
}
