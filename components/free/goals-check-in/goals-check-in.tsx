'use client'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { ChevronLeftIcon } from '@fetaui/react/rounded/chevron-left'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { motion } from 'motion/react'
import { useState, type CSSProperties, type HTMLAttributes } from 'react'
import { Avatar, type AvatarPerson } from '../avatar/avatar'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { Input } from '../input/input'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Progress } from '../progress/progress'
import { Tabs } from '../tabs/tabs'
import styles from './goals-check-in.module.css'

const UPDATE_S = 0.24
const STANDARD = [0.25, 0.1, 0.25, 1] as const

export type GoalStatus = 'on-track' | 'at-risk' | 'off-track'
const STATUS: Record<GoalStatus, string> = { 'on-track': 'On track', 'at-risk': 'At risk', 'off-track': 'Off track' }

export type Goal = {
  id: string
  title: string
  owner: string
  person?: AvatarPerson
  status: GoalStatus
  progress: number
  keyResult: string
  target: string
  current: string
  note?: string
  /** Before and after this check-in, like 52% → 83%. */
  change?: string
}

export type GoalCheckIn = { id: string; value: string; status: GoalStatus; note: string }

export type GoalsCheckInProps = Omit<HTMLAttributes<HTMLElement>, 'title' | 'onSubmit'> & {
  title?: string
  /** Week and overall progress. */
  summary: string
  /** Periods to step through. */
  periods: string[]
  goals: Goal[]
  /** Footer note. */
  due: string
  /** Opens on the check-in for the first goal. */
  defaultChecking?: boolean
  onSave?: (checkIn: GoalCheckIn) => void
  /** Fires with the period the stepper lands on. */
  onPeriodChange?: (period: string) => void
  animated?: boolean
}

const Status = ({ status }: { status: GoalStatus }) => (
  <span className={styles.status} data-status={status}>{status === 'on-track' ? <CheckIcon size={14} /> : <AlertCircleIcon size={14} />}{STATUS[status]}</span>
)

/** Quarterly goals. Check in opens the first goal with a key result, status and a note. */
export function GoalsCheckIn({ title = 'Company goals', summary, periods, goals, due, defaultChecking = false, onSave, onPeriodChange, animated = true, className, ...rest }: GoalsCheckInProps) {
  const still = useStill(animated)
  const [period, setPeriod] = useState(0)
  const [open, setOpen] = useState<string | null>(defaultChecking ? (goals[0]?.id ?? null) : null)
  const [draft, setDraft] = useState<GoalCheckIn | null>(null)
  const current = goals.find(({ id }) => id === open)
  const value = current ? (draft?.id === current.id ? draft : { id: current.id, value: current.current, status: current.status, note: current.note ?? '' }) : null
  const patch = (next: Partial<GoalCheckIn>): void => { if (value) setDraft({ ...value, ...next }) }
  const stepPeriod = (by: number): void => {
    const next = period + by
    setPeriod(next)
    const name = periods[next]
    if (name !== undefined) onPeriodChange?.(name)
  }

  return (
    <section data-still={animated ? undefined : ''} className={cx(styles.goals, className)} {...rest}>
      <header className={styles.header}>
        <div><h3 className={styles.title}>{title}</h3><p className={styles.sub}>{summary}</p></div>
        <div className={styles.period}>
          <IconButton variant="ghost" size="sm" icon={<ChevronLeftIcon />} label="Previous period" disabled={period === 0} animated={animated} onClick={() => stepPeriod(-1)} />
          <span aria-live="polite">{periods[period]}</span>
          <IconButton variant="ghost" size="sm" icon={<ChevronRightIcon />} label="Next period" disabled={period === periods.length - 1} animated={animated} onClick={() => stepPeriod(1)} />
        </div>
      </header>
      <ul className={styles.list}>
        {goals.map((goal, i) => {
          const expanded = goal.id === open
          return (
            <li key={goal.id} className={styles.goal} style={{ '--i': `${i * 40}ms` } as CSSProperties}>
              <button type="button" className={styles.row} aria-expanded={expanded} aria-controls={expanded ? `${goal.id}-panel` : undefined} onClick={() => setOpen(expanded ? null : goal.id)}>
                <span className={styles.chevron} data-open={expanded ? '' : undefined}><ChevronRightIcon size={16} /></span>
                <span className={styles.body}>
                  <span className={styles.name}>{goal.title}</span>
                  <span className={styles.owner}><Avatar size="xs" {...(goal.person ? { person: goal.person } : { initials: goal.owner.slice(0, 1) })} animated={animated} />{goal.owner}<Status status={goal.status} /></span>
                </span>
                <span className={styles.progress}>
                  <span className={styles.percent}>{goal.progress}%</span>
                  <Progress className={styles.bar} data-status={goal.status} size="sm" value={goal.progress} label={goal.title} animated={animated} />
                </span>
              </button>
              {expanded && value ? (
                <motion.div id={`${goal.id}-panel`} className={styles.panel} initial={still ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={still ? { duration: 0 } : { duration: UPDATE_S, ease: STANDARD }}>
                  <div className={styles.keyResult}><span>{goal.keyResult}</span><span className={styles.target}>{goal.target}</span></div>
                  <div className={styles.inputs}>
                    <Input aria-label={goal.keyResult} value={value.value} onChange={(e) => patch({ value: e.target.value })} animated={animated} />
                    <Tabs label="Status" items={(Object.keys(STATUS) as GoalStatus[]).map((status) => ({ value: status, label: STATUS[status] }))} value={value.status} onValueChange={(status) => patch({ status: status as GoalStatus })} animated={animated} />
                  </div>
                  <Input aria-label="Note" placeholder="What changed?" value={value.note} onChange={(e) => patch({ note: e.target.value })} animated={animated} />
                  <div className={styles.save}>
                    <span className={styles.change}>{goal.change}</span>
                    <span className={styles.saveActions}>
                      <Button variant="ghost" size="sm" animated={animated} onClick={() => { setDraft(null); setOpen(null) }}>Cancel</Button>
                      <Button size="sm" animated={animated} onClick={() => { onSave?.(value); setOpen(null) }}>Save check-in</Button>
                    </span>
                  </div>
                </motion.div>
              ) : null}
            </li>
          )
        })}
      </ul>
      <footer className={styles.footer}>
        <span>{due}</span>
        <Button variant="secondary" size="sm" animated={animated} onClick={() => setOpen(goals[0]?.id ?? null)}>Check in</Button>
      </footer>
    </section>
  )
}
