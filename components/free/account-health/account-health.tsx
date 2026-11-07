'use client'
import { motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { ChartBarLineIcon } from '@fetaui/react/rounded/chart-bar-line'
import { MessageIcon } from '@fetaui/react/rounded/message'
import { ReceiptIcon } from '@fetaui/react/rounded/receipt'
import { TrendingDownIcon } from '@fetaui/react/rounded/trending-down'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { Alert02Icon } from '@fetaui/react/rounded/alert-02'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { TicketIcon } from '@fetaui/react/rounded/ticket'
import { UserIcon } from '@fetaui/react/rounded/user'
import { ZapIcon } from '@fetaui/react/rounded/zap'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { RollingText, cx, useStill } from '../motion-kit/motion-kit'
import { Skeleton } from '../skeleton/skeleton'
import { Spinner } from '../spinner/spinner'
import { ToggleGroup } from '../toggle-group/toggle-group'
import { CountUp } from '../card-kit/card-kit'
import styles from './account-health.module.css'

/** From the 181 Motion frame: panel 400 ms, updates 240 ms, row stagger 40 ms, on motion/ease-standard. */
const EASE_STANDARD = [0.25, 0.1, 0.25, 1] as const
const PANEL_DURATION = 0.4
const VALUE_DURATION = 0.24
const ROW_STAGGER = 0.04
const PANEL_RISE = 8
const UPDATE = { duration: VALUE_DURATION, ease: EASE_STANDARD }

const SPARK_WIDTH = 60
const SPARK_HEIGHT = 16
const GAUGE_RADIUS = 43
const GAUGE_ARC = `M 5 53 A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 91 53`
const STATUS: Record<HealthStatus, { label: string; icon: ReactNode }> = {
  risk: { label: 'At risk', icon: <Alert02Icon size={12} /> },
  watch: { label: 'Watch', icon: <AlertCircleIcon size={12} /> },
  good: { label: 'Good', icon: <CheckIcon size={12} /> },
}

/** The usual signal icons, ready to pass as `icon`. */
export const HEALTH_ICONS = {
  usage: <ChartBarLineIcon size={16} />,
  seats: <UserIcon size={16} />,
  tickets: <TicketIcon size={16} />,
  nps: <MessageIcon size={16} />,
  invoice: <ReceiptIcon size={16} />,
}

export type HealthStatus = 'good' | 'watch' | 'risk'

export type HealthSignal = {
  id: string
  title: string
  detail: string
  /** Any short value, like `61%` or `14 open`. */
  value: string
  status: HealthStatus
  /** Oldest first. Any scale. */
  trend: number[]
  icon?: ReactNode
}

export type HealthSnapshot = {
  /** 0 to 100. */
  score: number
  scoreStatus: HealthStatus
  scoreLabel: string
  scoreNote: string
  signals: HealthSignal[]
  summary: string
}

export type AccountHealthProps = {
  account: string
  plan: string
  /** Period label to its numbers, like `30d`. The first is the default. */
  periods: Record<string, HealthSnapshot>
  period?: string
  onPeriodChange?: (period: string) => void
  renewalLabel: string
  /** Days to renewal. */
  daysLeft: number
  /** The length of the term in days, for the bar. Default 365. */
  termDays?: number
  logo?: ReactNode
  /** The model name beside the summary. Hidden on Mobile. */
  model?: string
  /** The summary shows as a skeleton while this is true. */
  loading?: boolean
  /** Adds the refresh Icon Button. */
  onRefresh?: () => void
  actionTitle: string
  actionDetail: string
  actionLabel: string
  onAction?: () => void
  animated?: boolean
  className?: string
}

const score = (value: number): string => String(Math.round(value))
const days = (value: number): string => String(Math.round(value))

function sparkPath(points: number[]): { path: string; end: [number, number] } {
  const low = Math.min(...points)
  const span = Math.max(...points) - low || 1
  const at = points.map((point, index): [number, number] => [(index / Math.max(points.length - 1, 1)) * SPARK_WIDTH, SPARK_HEIGHT - ((point - low) / span) * SPARK_HEIGHT + 2])
  return { path: at.map(([x, y], index) => `${index ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' '), end: at.at(-1) ?? [0, 0] }
}

function Spark({ points, status, still }: { points: number[]; status: HealthStatus; still: boolean }) {
  const { path, end } = sparkPath(points)
  const transition = still ? { duration: 0 } : UPDATE
  return (
    <svg className={styles.spark} viewBox="-1 -1 66 22" data-status={status} aria-hidden="true">
      <motion.path d={path} initial={false} animate={{ d: path }} transition={transition} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <motion.circle r="3" fill="currentColor" initial={false} animate={{ cx: end[0], cy: end[1] }} transition={transition} />
    </svg>
  )
}

/** Customer health: a score gauge, renewal, signals with sparklines, a risk summary and the next step. */
export function AccountHealth({ account, plan, periods, period, onPeriodChange, renewalLabel, daysLeft, termDays = 365, logo, model, loading = false, onRefresh, actionTitle, actionDetail, actionLabel, onAction, animated = true, className }: AccountHealthProps) {
  const still = useStill(animated)
  const id = useId()
  const labels = Object.keys(periods)
  const [held, setHeld] = useState(labels[0] ?? '')
  const current = period ?? held
  const data = periods[current] ?? Object.values(periods)[0]
  if (!data) return null
  const used = 1 - Math.min(daysLeft / termDays, 1)

  return (
    <motion.section
      className={cx(styles.tray, className)}
      aria-labelledby={`${id}-name`}
      data-still={still ? '' : undefined}
      initial={still ? false : { opacity: 0, y: PANEL_RISE }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: PANEL_DURATION, ease: EASE_STANDARD }}
    >
      <div className={styles.body}>
        <header className={styles.header}>
          <span className={styles.logo}>{logo ?? <ZapIcon size={16} />}</span>
          <div className={styles.names}>
            <h3 id={`${id}-name`} className={styles.account}>{account}</h3>
            <p className={styles.small}>{plan}</p>
          </div>
          <ToggleGroup
            className={cx(styles.periods)}
            type="single"
            label="Period"
            items={labels.map((value) => ({ value, label: value }))}
            value={current}
            animated={animated}
            onValueChange={(next) => { if (!next) return; setHeld(next); onPeriodChange?.(next) }}
          />
        </header>

        <div className={styles.scoreRow}>
          <div className={styles.health}>
            <div className={styles.gauge} role="img" aria-label={`Health score ${data.score} of 100`}>
              <svg viewBox="0 0 96 58" aria-hidden="true" data-status={data.scoreStatus}>
                <path className={styles.gaugeTrack} d={GAUGE_ARC} />
                <motion.path className={styles.gaugeValue} d={GAUGE_ARC} initial={false} animate={{ pathLength: data.score / 100 }} transition={still ? { duration: 0 } : UPDATE} />
              </svg>
              <CountUp className={styles.score} value={data.score} from={data.score} format={score} duration={VALUE_DURATION} still={still} />
            </div>
            <div className={styles.healthText}>
              <p className={styles.stateLabel} data-status={data.scoreStatus}>{STATUS[data.scoreStatus].icon}<span>{data.scoreLabel}</span></p>
              <p className={styles.trend}><TrendingDownIcon size={12} /><span>{data.scoreNote}</span></p>
            </div>
          </div>
          <span className={styles.vrule} aria-hidden="true" />
          <div className={styles.renewal}>
            <p className={styles.small}>{renewalLabel}</p>
            <span className={styles.bar} role="img" aria-label={`${daysLeft} days left of ${termDays}`}><span className={styles.barFill} style={{ transform: `scaleX(${used})` }} /></span>
            <p className={styles.days}><CountUp className={styles.daysValue} value={daysLeft} from={daysLeft} format={days} duration={VALUE_DURATION} still={still} /><span className={styles.small}>days left</span></p>
          </div>
        </div>

        <ul className={styles.signals}>
          {data.signals.map((signal, index) => (
            <motion.li key={signal.id} className={styles.signal} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: VALUE_DURATION, ease: EASE_STANDARD, delay: index * ROW_STAGGER }}>
              {signal.icon ? <span className={styles.signalIcon}>{signal.icon}</span> : null}
              <div className={styles.signalText}><p className={styles.signalTitle}>{signal.title}</p><p className={styles.small}>{signal.detail}</p></div>
              <Spark points={signal.trend} status={signal.status} still={still} />
              <span className={styles.signalValue}><RollingText value={signal.value.replaceAll(' ', '\u00a0')} still={still} /></span>
              <span className={styles.status} data-status={signal.status}>{STATUS[signal.status].icon}{STATUS[signal.status].label}</span>
            </motion.li>
          ))}
        </ul>

        <div className={styles.summary} aria-busy={loading || undefined}>
          <div className={styles.summaryHead}>
            <span className={styles.summaryIcon}><SparklesIcon size={16} /></span>
            <h4 className={styles.signalTitle}>Risk summary</h4>
            {model ? <span className={styles.model}>{model}</span> : null}
            {loading ? <span className={styles.refreshSlot}><Spinner size="s" label="Refreshing the summary" animated={!still} /></span>
              : onRefresh ? <IconButton variant="ghost" size="sm" icon={<RefreshCwIcon />} label="Refresh the summary" animated={animated} onClick={onRefresh} /> : null}
          </div>
          {loading ? (
            <div className={styles.skeleton}><Skeleton height={12} animated={!still} /><Skeleton height={12} animated={!still} /><Skeleton height={12} width="62%" animated={!still} /></div>
          ) : <p className={styles.summaryText}>{data.summary}</p>}
        </div>

        <div className={styles.action}>
          <div className={styles.actionText}><p className={styles.signalTitle}>{actionTitle}</p><p className={styles.small}>{actionDetail}</p></div>
          <Button shape="pill" animated={animated} onClick={onAction}>{actionLabel}</Button>
        </div>
      </div>
    </motion.section>
  )
}
