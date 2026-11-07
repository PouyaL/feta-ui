'use client'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { ClockIcon } from '@fetaui/react/rounded/clock'
import { DownloadIcon } from '@fetaui/react/rounded/download'
import { LockIcon } from '@fetaui/react/rounded/lock'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { NavigationIcon } from '@fetaui/react/rounded/navigation'
import { animate } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { ease } from '../../motion-tokens'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import { Spinner } from '../spinner/spinner'
import styles from './progress.module.css'

const FILL_S = 0.3
const OUT = ease.out

const percent = (value: number, max: number): number => Math.min(Math.max((value / max) * 100, 0), 100)

/** Counts the number up with the fill, writing straight to the node. */
function useCount(value: number, still: boolean): React.RefObject<HTMLSpanElement | null> {
  const ref = useRef<HTMLSpanElement>(null)
  const from = useRef(value)
  useEffect(() => {
    const node = ref.current
    if (!node) return undefined
    if (still) { node.textContent = String(Math.round(value)); from.current = value; return undefined }
    const controls = animate(from.current, value, { duration: FILL_S, ease: OUT, onUpdate: (v) => { node.textContent = String(Math.round(v)) } })
    from.current = value
    return () => controls.stop()
  }, [value, still])
  return ref
}

/** A number that counts with the bar. Mono, so the width holds. */
export function ProgressValue({ value, animated = true, className }: { value: number; animated?: boolean; className?: string }) {
  const ref = useCount(value, useStill(animated))
  return <span ref={ref} className={className}>{Math.round(value)}</span>
}

export type ProgressProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** Leave it out, or set `state="indeterminate"`, when the end is unknown. */
  value?: number
  /** Default 100. */
  max?: number
  /** 4, 8 or 12 px. Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** Worked out from `value` unless set. */
  state?: 'empty' | 'partial' | 'complete' | 'indeterminate' | 'paused' | 'error'
  /** What is progressing. */
  label: string
  animated?: boolean
}

const watch = (node: HTMLDivElement): (() => void) => watchOffscreen(node)

/** Shows how far a task has come. */
export function Progress({ value, max = 100, size = 'md', state, label, animated = true, className, style, ...rest }: ProgressProps) {
  const unknown = state === 'indeterminate' || (value === undefined && state === undefined)
  const pct = percent(value ?? 0, max)
  const shown = state ?? (unknown ? 'indeterminate' : pct >= 100 ? 'complete' : pct <= 0 ? 'empty' : 'partial')
  // The fill only eases forward. A restart jumps back.
  const last = useRef(pct)
  const [back, setBack] = useState(false)
  useEffect(() => { setBack(pct < last.current); last.current = pct }, [pct])
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      {...(unknown ? {} : { 'aria-valuenow': value ?? 0 })}
      {...(shown === 'indeterminate' ? { ref: watch, 'data-loop': '' } : {})}
      data-size={size}
      data-state={shown}
      data-back={back ? '' : undefined}
      data-still={animated ? undefined : ''}
      className={cx(styles.track, className)}
      style={{ '--pct': `${pct}%`, ...style } as CSSProperties}
      {...rest}
    >
      <span className={styles.fill} />
    </div>
  )
}

const Shell = ({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) => (
  <div className={cx(styles.shell, className)}>
    <div className={styles.body}>{children}</div>
    {footer ? <div className={styles.footer}>{footer}</div> : null}
  </div>
)

type Recipe = { value: number; animated?: boolean }

export function ProgressLabel({ title, value, action, hint, animated }: Recipe & { title: string; action?: ReactNode; hint?: ReactNode }) {
  return (
    <Shell footer={action || hint ? <>{action}{hint ? <span className={styles.hint}><LockIcon size={14} />{hint}</span> : null}</> : undefined}>
      <div className={styles.row}><span className={styles.name}>{title}</span><span className={styles.mono}><ProgressValue value={value} animated={animated ?? true} />%</span></div>
      <Progress value={value} label={title} animated={animated ?? true} />
    </Shell>
  )
}

export function ProgressTip({ title, value, animated }: Recipe & { title: string }) {
  return (
    <Shell>
      <span className={styles.muted}>{title}</span>
      <div className={styles.tipBar} style={{ '--pct': `${value}%` } as CSSProperties}>
        <span className={styles.rail} data-still={animated === false ? '' : undefined}><span className={styles.tip}><ProgressValue value={value} animated={animated ?? true} />%</span></span>
        <Progress value={value} label={title} animated={animated ?? true} />
      </div>
    </Shell>
  )
}

export type ProgressStage = { label: string; value: number }

export function ProgressSegments({ stages, animated }: { stages: ProgressStage[]; animated?: boolean }) {
  return (
    <Shell>
      <ol className={styles.segments}>
        {stages.map(({ label, value }) => (
          <li key={label} data-reached={value > 0 ? '' : undefined}>
            <span className={styles.segmentLabel}>{label}</span>
            <span className={styles.segmentDot} />
            <Progress size="sm" value={value} label={label} {...(value >= 100 ? { state: 'partial' as const } : {})} animated={animated ?? true} />
          </li>
        ))}
      </ol>
    </Shell>
  )
}

export function ProgressSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <Shell>
      <ol className={styles.steps}>
        {steps.map((step, i) => (
          <li key={step} data-status={i < current ? 'done' : i === current ? 'current' : 'next'} {...(i === current ? { 'aria-current': 'step' as const } : {})}>
            <span className={styles.stepMark}>{i < current ? <CheckIcon size={12} /> : null}</span>
            <span className={styles.stepLabel}>{step}</span>
          </li>
        ))}
      </ol>
    </Shell>
  )
}

export function ProgressEta({ title, value, left, animated }: Recipe & { title: string; left: string }) {
  return (
    <Shell>
      <div className={styles.row}><span className={styles.name}>{title}</span><span className={styles.mono}><ProgressValue value={value} animated={animated ?? true} />%</span></div>
      <Progress value={value} label={title} animated={animated ?? true} />
      <span className={styles.hint}><ClockIcon size={14} />{left}</span>
    </Shell>
  )
}

export function ProgressUpload({ title, value, animated }: Recipe & { title: string }) {
  const done = value >= 100
  return (
    <Shell>
      <div className={styles.row}>
        <span className={styles.hint}><Spinner kind="dots" size="s" label={null} animated={animated ?? true} />{title}</span>
        <span className={styles.big}><ProgressValue value={value} animated={animated ?? true} /><small>%</small></span>
      </div>
      <div className={styles.knobBar} style={{ '--pct': `${value}%` } as CSSProperties} data-moving={done ? undefined : ''} data-still={animated === false ? '' : undefined}>
        <Progress size="sm" value={value} {...(done ? { state: 'partial' as const } : {})} label={title} animated={animated ?? true} />
        <span className={styles.rail}><span className={styles.knob} /></span>
      </div>
    </Shell>
  )
}

export function ProgressDownload({ value, chunks = 12, animated }: Recipe & { chunks?: number }) {
  return (
    <Shell>
      <div className={styles.row}><span className={styles.hint}><DownloadIcon size={16} /><strong>Download</strong> in progress</span></div>
      <span className={styles.hint}><strong>{Math.round(value)}%</strong> complete</span>
      <div className={styles.chunks} role="progressbar" aria-label="Download" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} data-still={animated === false ? '' : undefined} style={{ '--pct': `${value}%`, '--chunks': chunks } as CSSProperties}><span /></div>
    </Shell>
  )
}

export function ProgressTicks({ title, description, value, delta, compared, ticks = 66 }: { title: string; description: string; value: number; delta: string; compared: string; ticks?: number }) {
  const lit = Math.round((value / 100) * ticks)
  return (
    <Shell>
      <div className={styles.row}>
        <span><span className={styles.name}>{title}</span><span className={styles.small}>{description}</span></span>
        <IconButton variant="ghost" size="sm" icon={<MoreHorizontalIcon />} label="More" />
      </div>
      <div className={styles.delta}><strong>{value}%</strong><span className={styles.pill}>↗ {delta}</span><span className={styles.small}>{compared}</span></div>
      <div className={styles.ticks} role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        {Array.from({ length: ticks }, (_, i) => <span key={i} data-lit={i < lit ? '' : undefined} />)}
      </div>
    </Shell>
  )
}

export type ProgressFlightProps = {
  value: number
  from: { code: string; city: string; time: string }
  to: { code: string; city: string; time: string }
  status: string
  flight: string
  left: string
  animated?: boolean
}

const ARC = 'M6 44 C 90 4, 210 4, 294 44'

/** A plane on the line. Its position comes from the real curve. */
export function ProgressFlight({ value, from, to, status, flight, left, animated = true }: ProgressFlightProps) {
  const still = useStill(animated)
  const path = useRef<SVGPathElement>(null)
  const plane = useRef<SVGGElement>(null)
  const trail = useRef<SVGPathElement>(null)
  useEffect(() => {
    const line = path.current
    const mark = plane.current
    const lit = trail.current
    if (!line || !mark || !lit) return
    const total = line.getTotalLength()
    const at = (total * value) / 100
    const p = line.getPointAtLength(at)
    // At the end of the path there is nothing ahead, so the heading comes from behind.
    const [a, b] = at + 1 <= total ? [p, line.getPointAtLength(at + 1)] : [line.getPointAtLength(total - 1), p]
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    mark.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${angle + 90}deg)`
    lit.style.strokeDashoffset = String(100 - value)
  }, [value])
  return (
    <Shell footer={<><span className={styles.flight}>{flight}</span><span className={styles.small}>{left}</span></>}>
      <div className={styles.row}><span className={styles.flight}>DEPARTURE {from.time}</span><span className={styles.flight}>ARRIVAL {to.time}</span></div>
      <div className={styles.route}>
        <span><strong>{from.code}</strong><span className={styles.small}>{from.city}</span></span>
        <svg viewBox="0 0 300 52" fill="none" aria-hidden="true" data-still={still ? '' : undefined}>
          <path ref={path} d={ARC} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="2 4" />
          <path ref={trail} className={styles.trail} d={ARC} stroke="currentColor" strokeWidth="1.5" pathLength={100} strokeDasharray="100 100" strokeDashoffset={100} />
          <g ref={plane} className={styles.plane}><g transform="translate(-9 -9)"><NavigationIcon size={18} /></g></g>
        </svg>
        <span data-end=""><strong>{to.code}</strong><span className={styles.small}>{to.city}</span></span>
      </div>
      <span className={styles.chip}><span />{status}</span>
    </Shell>
  )
}

