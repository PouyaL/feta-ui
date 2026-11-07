'use client'
import { type HTMLAttributes, type Ref } from 'react'
import { kit, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './spinner.module.css'

const SIZES = { xs: 12, s: 16, m: 20, l: 24, xl: 32 } as const
const BARS = 8
const DOTS = 3
/** 28% of the circle. */
const ARC_SHARE = 28

/** The observer only reads `closest`, which SVG has too. Stable, so it does not re-subscribe each render. */
const watch = (node: SVGSVGElement): (() => void) => watchOffscreen(node as unknown as HTMLElement)

export type SpinnerProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  /** Default `arc`. */
  kind?: 'arc' | 'bars' | 'dots' | 'orbit'
  /** Named size or pixels. Default `m`. */
  size?: keyof typeof SIZES | number
  /** Hidden text for screen readers. Pass `null` when the label beside the spinner already says it. */
  label?: string | null
  /** Milliseconds to wait before showing. Use 300 when the wait may be short. */
  delay?: number
  /** `false` holds the spinner still, here or from `ComponentAnimation` above. */
  animated?: boolean
  ref?: Ref<HTMLSpanElement>
}

/** Says something is happening. Coloured by the text around it. */
export function Spinner({ kind = 'arc', size = 'm', label = 'Loading', delay = 0, animated = true, className, style, ref, ...rest }: SpinnerProps) {
  const px = typeof size === 'number' ? size : SIZES[size]
  const stroke = Math.max(px / 10, 1.5)
  const r = (px - stroke) / 2
  const c = px / 2
  return (
    <span
      ref={ref}
      {...(label === null ? { 'aria-hidden': true } : { role: 'status' })}
     
      data-loop=""
      data-kind={kind}
      data-still={animated ? undefined : ''}
      data-delayed={delay > 0 ? '' : undefined}
      className={[styles.spinner, className].filter(Boolean).join(' ')}
      style={{ width: px, height: px, '--spinner-delay': `${delay}ms`, ...style } as HTMLAttributes<HTMLSpanElement>['style']}
      {...rest}
    >
      {label === null ? null : <span className={kit.srOnly}>{label}</span>}
      <svg ref={watch} className={styles.rotor} width={px} height={px} viewBox={`0 0 ${px} ${px}`} fill="none" aria-hidden="true">
        {kind === 'arc' ? (
          <>
            <circle className={styles.track} cx={c} cy={c} r={r} strokeWidth={stroke} />
            <circle cx={c} cy={c} r={r} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" pathLength={100} strokeDasharray={`${ARC_SHARE} ${100 - ARC_SHARE}`} />
          </>
        ) : null}
        {kind === 'bars' ? Array.from({ length: BARS }, (_, i) => (
          <line
            key={i}
           
            x1={c} x2={c} y1={px * 0.08} y2={px * 0.3}
            stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
            opacity={(i + 1) / BARS}
            transform={`rotate(${(i * 360) / BARS} ${c} ${c})`}
          />
        )) : null}
        {kind === 'dots' ? Array.from({ length: DOTS }, (_, i) => (
          <circle key={i} className={styles.dot} style={{ animationDelay: `${i * 200}ms` }} cx={px * (0.2 + i * 0.3)} cy={c} r={px * 0.11} fill="currentColor" />
        )) : null}
        {kind === 'orbit' ? (
          <>
            <circle className={styles.track} cx={c} cy={c} r={r} strokeWidth={Math.max(px / 20, 1)} />
            <circle cx={c} cy={stroke * 0.9} r={stroke * 0.9} fill="currentColor" />
            <circle cx={c} cy={px - stroke * 0.9} r={stroke * 0.65} fill="currentColor" />
          </>
        ) : null}
      </svg>
    </span>
  )
}
