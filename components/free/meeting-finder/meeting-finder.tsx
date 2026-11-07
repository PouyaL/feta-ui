'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Alert02Icon } from '@fetaui/react/rounded/alert-02'
import { CalendarIcon } from '@fetaui/react/rounded/calendar'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { ClockIcon } from '@fetaui/react/rounded/clock'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { SunIcon } from '@fetaui/react/rounded/sun'
import { UserIcon } from '@fetaui/react/rounded/user'
import { XIcon } from '@fetaui/react/rounded/x'
import { spring } from '../../motion-tokens'
import { Avatar, type AvatarPerson } from '../avatar/avatar'
import { Badge } from '../badge/badge'
import { Button } from '../button/button'
import { form } from '../form-kit/form-kit'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import styles from './meeting-finder.module.css'

/** Values and rows update in 240 ms on the standard ease, from the Meeting Finder Motion frame. */
const UPDATE_S = 0.24
const EASE_STANDARD = [0.25, 0.1, 0.25, 1] as const

export type FinderPerson = {
  id: string
  name: string
  busy: [start: number, end: number][]
  /** One of the illustrated people for the avatar. */
  person?: AvatarPerson
  /** A real photo for the avatar. */
  src?: string
  /** Shown when there is no photo or person. Defaults to the first letters of the first two words of `name`. */
  initials?: string
}
export type FinderSuggestion = { id: string; label: string; start: number; end: number; note: string; /** Marks a note worth a second look. */ warning?: boolean }
export type FinderConstraintKind = 'duration' | 'people' | 'date' | 'time'
export type FinderConstraint = {
  label: string
  /** Secondary detail after the label. Mobile keeps it for screen readers only. */
  value?: string
  /** Picks the leading icon: clock, person, calendar or sun. */
  kind?: FinderConstraintKind
  /** Replaces the icon from `kind`. */
  icon?: ReactNode
}

const KIND_ICON: Record<FinderConstraintKind, () => ReactNode> = {
  duration: () => <ClockIcon />,
  people: () => <UserIcon />,
  date: () => <CalendarIcon />,
  time: () => <SunIcon />,
}
const initialsOf = (name: string): string => name.trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase()
const chipIcon = (one: FinderConstraint): ReactNode => one.icon ?? (one.kind ? KIND_ICON[one.kind]() : null)
/** A stable ref, so the shimmer's offscreen pause subscribes once per mount, not once per render. */
const watchSkeletons = (node: HTMLDivElement | null): (() => void) | undefined => (node ? watchOffscreen(node) : undefined)

export type MeetingFinderProps = {
  people: FinderPerson[]
  /** The prompt the field starts with. */
  defaultPrompt?: string
  /** Constraints shown as chips. */
  defaultConstraints?: FinderConstraint[]
  /** Adds a remove button to each chip. Default `false`. */
  removable?: boolean
  /** The day and range over the timeline, like Tue, Nov 3 and 9 AM to 12 PM ET. */
  day?: string
  range?: string
  /** Ranked times for a prompt, best first. */
  onFind: (prompt: string, constraints: FinderConstraint[]) => Promise<FinderSuggestion[]>
  onPick?: (suggestion: FinderSuggestion) => void
  /** Shown when onFind rejects. */
  failedMessage?: string
  /** Shown when onFind resolves with no times. */
  emptyMessage?: string
  placeholder?: string
  /** The first and last hour of the timeline. */
  from?: number
  to?: number
  animated?: boolean
  className?: string
}

/** Ask for a meeting in plain words, then compare ranked times on everyone's timeline. */
export function MeetingFinder({ people, defaultPrompt = '', defaultConstraints = [], removable = false, day, range, onFind, onPick, failedMessage = 'Could not find times. Try again.', emptyMessage = 'No time fits everyone. Try fewer constraints.', placeholder = 'Find an hour with the team next week', from = 9, to = 12, animated = true, className }: MeetingFinderProps) {
  const still = useStill(animated)
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [constraints, setConstraints] = useState(defaultConstraints)
  const [status, setStatus] = useState<'idle' | 'searching' | 'done' | 'failed'>('idle')
  const [results, setResults] = useState<FinderSuggestion[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  async function find(): Promise<void> {
    if (status === 'searching') return
    setStatus('searching')
    let found: FinderSuggestion[]
    try {
      found = await onFind(prompt, constraints)
    } catch {
      if (alive.current) { setResults([]); setPicked(null); setStatus('failed') }
      return
    }
    if (!alive.current) return
    setResults(found)
    setPicked(found[0]?.id ?? null)
    setStatus('done')
  }

  const best = results.find((one) => one.id === picked)
  const span = to - from
  const pct = (hours: number): string => `${(hours / span) * 100}%`
  const hours = Array.from({ length: span + 1 }, (_, i) => from + i)

  return (
    <section className={cx(styles.finder, className)} aria-label="Find a meeting time" data-still={still ? '' : undefined}>
      <div className={styles.body}>
        <form className={styles.prompt} onSubmit={(e) => { e.preventDefault(); void find() }}>
          <SparklesIcon size={16} className={styles.spark} />
          <input className={styles.entry} aria-label="Describe the meeting" placeholder={placeholder} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          {/* Mobile wraps the prompt to two lines; the mirror draws them with an ending ellipsis while the field is not focused. */}
          <span className={styles.wrap}>
            <textarea
              className={styles.area}
              rows={1}
              aria-label="Describe the meeting"
              placeholder={placeholder}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }}
            />
            <span className={styles.mirror} aria-hidden="true" data-empty={prompt ? undefined : ''}>{prompt || placeholder}</span>
          </span>
          <Button type="submit" size="sm" shape="pill" className={styles.findLong} animated={animated} status={status === 'searching' ? 'loading' : 'idle'} trailingIcon={<ChevronRightIcon className={styles.go} />}>Find times</Button>
          <Button type="submit" size="sm" shape="pill" className={styles.findShort} aria-label="Find times" animated={animated} status={status === 'searching' ? 'loading' : 'idle'} trailingIcon={<ChevronRightIcon className={styles.go} />}>Find</Button>
        </form>
        {constraints.length ? (
          <ul className={styles.chips} aria-label="Constraints" data-removable={removable ? '' : undefined}>
            <AnimatePresence initial={false}>
              {constraints.map((one) => (
                <motion.li key={one.label} className={styles.chip} initial={still ? false : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { scale: 0.9, opacity: 0 }} transition={still ? { duration: 0 } : spring.pop}>
                  {chipIcon(one) ? <span className={styles.chipIcon} aria-hidden="true">{chipIcon(one)}</span> : null}
                  <span className={styles.chipLabel}>{one.label}</span>
                  {one.value ? <span className={styles.chipValue}>{one.value}</span> : null}
                  {removable ? <button type="button" className={styles.remove} aria-label={`Remove ${one.label}`} onClick={() => setConstraints((all) => all.filter((item) => item !== one))}><XIcon /></button> : null}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : null}
        <div className={styles.rule} />
        <div className={styles.day} aria-hidden="true">
          {day || range ? <div className={styles.head}><span className={styles.dayName}>{day}</span><span className={styles.range}>{range}</span></div> : null}
          <div className={styles.lanes}>
            {people.map((person) => (
              <div key={person.id} className={styles.person}>
                <Avatar size="xs" {...(person.person ? { person: person.person } : {})} {...(person.src ? { src: person.src } : {})} initials={person.initials ?? initialsOf(person.name)} animated={animated} />
                <span className={styles.name}>{person.name}</span>
                <span className={styles.lane}>
                  {person.busy.map(([s, e]) => <i key={s} className={styles.busy} style={{ left: pct(s - from), width: pct(e - s) }} />)}
                </span>
              </div>
            ))}
            <AnimatePresence>
              {status === 'done' && best ? (
                <motion.span
                  key="track"
                  className={styles.track}
                  initial={still ? false : { opacity: 0, x: pct(best.start - from) }}
                  animate={{ opacity: 1, x: pct(best.start - from) }}
                  exit={{ opacity: 0, transition: { duration: still ? 0 : UPDATE_S } }}
                  transition={{ duration: still ? 0 : UPDATE_S, ease: EASE_STANDARD }}
                >
                  <i className={styles.proposed} style={{ width: pct(best.end - best.start) }} />
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
          <div className={styles.axis}>{hours.map((hour) => <span key={hour}>{hour % 12 || 12} {hour >= 12 ? 'PM' : 'AM'}</span>)}</div>
        </div>
        {status === 'idle' ? null : <div className={styles.rule} />}
        <div className={styles.results} role="status" data-state={status}>
          {status === 'searching' ? (
            <div ref={watchSkeletons} className={styles.skeletons} data-loop="">
              {[0, 1, 2].map((i) => <i key={i} className={styles.skeleton} />)}
              <span className={form.srOnly}>Searching</span>
            </div>
          ) : status === 'failed' ? (
            <p className={styles.message} data-failed="">{failedMessage}</p>
          ) : status === 'done' && results.length === 0 ? (
            <p className={styles.message}>{emptyMessage}</p>
          ) : status === 'done' ? (
            <ol className={styles.list}>
              {results.map((one, i) => (
                <li key={one.id} className={styles.row} style={{ '--i': i } as CSSProperties}>
                  <button type="button" aria-pressed={picked === one.id} className={styles.suggestion} onClick={() => { setPicked(one.id); onPick?.(one) }}>
                    <span className={styles.text}>
                      <span className={styles.slot}>{one.label}</span>
                      <span className={styles.note} data-warning={one.warning ? '' : undefined}>
                        {one.warning ? <Alert02Icon size={12} className={styles.noteIcon} /> : <CheckIcon size={12} className={styles.noteIcon} />}
                        <span className={styles.noteText}>{one.note}</span>
                      </span>
                    </span>
                    {i === 0 ? <Badge tone="success" size="sm" className={styles.best} animated={animated}>Best</Badge> : null}
                    <ChevronRightIcon size={14} className={styles.chevron} />
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      </div>
    </section>
  )
}
