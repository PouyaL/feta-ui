'use client'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { XIcon } from '@fetaui/react/rounded/x'
import { AnimatePresence, motion } from 'motion/react'
import { type HTMLAttributes, type ReactNode } from 'react'
import { spring } from '../../motion-tokens'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import { Spinner } from '../spinner/spinner'
import styles from './loader.module.css'

export type LoaderStep = {
  label: string
  status: 'done' | 'current' | 'waiting'
  /** Mono value at the end of the row, like DONE or 64%. */
  meta?: string
}

export type LoaderProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** Default `spinning`. */
  state?: 'spinning' | 'progress' | 'done' | 'error'
  title: ReactNode
  description?: ReactNode
  /** The percent inside the rings, for `progress`. */
  value?: number
  steps?: LoaderStep[]
  /** Mono note on the tray, like WORKING or ERROR 504. */
  status?: string
  /** Buttons on the tray. */
  actions?: ReactNode
  animated?: boolean
}

const watch = (node: HTMLDivElement): (() => void) => watchOffscreen(node)

const RINGS = [34, 25, 16] as const
const ARC_SHARE = [24, 32, 24] as const
const WIDTHS = [2, 3, 2] as const

/** Takes over a panel during longer setup, and shows progress, success and failure in place. */
export function Loader({ state = 'spinning', title, description, value = 0, steps, status, actions, animated = true, className, ...rest }: LoaderProps) {
  const still = useStill(animated)
  const working = state === 'spinning' || state === 'progress'
  return (
    <section aria-busy={working || undefined} data-state={state} data-still={animated ? undefined : ''} className={cx(styles.loader, className)} {...rest}>
      <div className={styles.card}>
        <div className={styles.head}>
          <div className={styles.rings} data-keep-motion="" data-loop="" ref={watch}>
            <svg data-keep-motion="" viewBox="0 0 76 76" width="100%" height="100%" fill="none" aria-hidden="true">
              <circle className={styles.track} data-keep-motion="" cx="38" cy="38" r={RINGS[0] + 3} strokeWidth="1" />
              <circle className={styles.track} data-keep-motion="" cx="38" cy="38" r={RINGS[2] + 2} strokeWidth="1" />
              {working ? RINGS.map((r, i) => (
                <circle key={r} data-keep-motion="" data-ring={i} className={styles.arc} cx="38" cy="38" r={r} strokeWidth={WIDTHS[i]} strokeLinecap="round" pathLength={100} strokeDasharray={`${ARC_SHARE[i]} 100`} />
              )) : null}
            </svg>
            <AnimatePresence initial={false}>
              {state === 'done' || state === 'error' ? (
                <motion.span key={state} className={styles.result} initial={still ? { opacity: 0 } : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={still ? { duration: 0.12 } : spring.stamp}>
                  {state === 'done' ? <CheckIcon /> : <XIcon />}
                </motion.span>
              ) : null}
            </AnimatePresence>
            {state === 'progress' ? <span className={styles.percent}>{Math.round(value)}%</span> : null}
            {state === 'spinning' ? <span className={styles.core} data-keep-motion="" /> : null}
          </div>
          <div className={styles.text} role={state === 'done' ? 'status' : state === 'error' ? 'alert' : undefined}>
            <div className={styles.title}>{title}</div>
            {description ? <div className={styles.description}>{description}</div> : null}
          </div>
        </div>
        {steps?.length ? (
          <ul className={styles.steps}>
            {steps.map((step) => (
              <li key={step.label} data-status={step.status}>
                <span className={styles.stepMark}>
                  {step.status === 'done' ? <span className={styles.stepDone}><CheckIcon size={10} /></span> : null}
                  {step.status === 'current' ? <Spinner size="s" label={null} animated={animated} /> : null}
                  {step.status === 'waiting' ? <span className={styles.stepWaiting} /> : null}
                </span>
                <span className={styles.stepLabel}>{step.label}</span>
                {step.meta ? <span className={styles.stepMeta}>{step.meta}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {status || actions ? (
        <footer className={styles.footer}>
          <span className={styles.status}>{status}</span>
          <span className={styles.actions}>{actions}</span>
        </footer>
      ) : null}
    </section>
  )
}
