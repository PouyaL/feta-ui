'use client'
import { motion } from 'motion/react'
import { useId, useState, type ComponentType, type ReactNode } from 'react'
import { ActivityIcon } from '@fetaui/react/rounded/activity'
import { ClockIcon } from '@fetaui/react/rounded/clock'
import { FileTextIcon } from '@fetaui/react/rounded/file-text'
import { HardDriveIcon } from '@fetaui/react/rounded/hard-drive'
import { UserIcon } from '@fetaui/react/rounded/user'
import { ease } from '../../motion-tokens'
import { Card } from '../card/card'
import { Checkbox } from '../checkbox/checkbox'
import { cx, useStill } from '../motion-kit/motion-kit'
import { CountUp } from '../card-kit/card-kit'
import styles from './bento-widget.module.css'

/** Value arrives: 600 ms, bars stagger 20 ms, from the 16.5 Motion frame. */
const ARRIVE_DURATION = 0.6
const BAR_STAGGER = 0.02

/** Hydration can turn `still` on after the first paint, so the transition has to follow it. */
const arrive = (still: boolean, delay = 0) => (still ? { duration: 0 } : { duration: ARRIVE_DURATION, ease: ease.out, delay })

const money = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`
const whole = (value: number): string => Math.round(value).toLocaleString('en-US')
const percent = (value: number): string => `${value.toFixed(2)}%`
const gigabytes = (value: number): string => `${Math.round(value)} GB`

export type BentoWidgetKind = 'revenue' | 'active-users' | 'activity' | 'notes' | 'uptime' | 'storage'
export type BentoWidgetSize = 'small' | 'medium' | 'large'

export type RevenueData = { value: number; change: string; note: string; points: number[]; breakdown: { label: string; amount: string }[] }
export type ActiveUsersData = { value: number; change: string; note: string; shortNote: string; days: { label: string; value: number }[] }
export type ActivityData = { events: { text: string; time: string }[]; latestWhen: string }
export type NoteItem = { id: string; text: string; done: boolean }
export type NotesData = { title: string; items: NoteItem[]; /** Ids shown at Medium, in order. Default the first three. */ featured?: string[] }
export type UptimeData = { value: number; summary: string; /** Days ago, shown in status colour. */ incident: number; incidentNote: string }
export type StorageData = { used: number; total: number; parts: { label: string; size: number }[] }

export const BENTO_DATA = {
  revenue: {
    value: 48210, change: '+12.4%', note: 'vs last month',
    points: [34, 27.9, 25.9, 20.7, 18.4, 18, 21.8, 24, 16.8, 15.7, 18.4, 13.8, 12, 6.3, 9.1, 6, 1.1, 0],
    breakdown: [{ label: 'New', amount: '$6,140' }, { label: 'Expansion', amount: '$2,380' }, { label: 'Churned', amount: '−$1,190' }],
  } satisfies RevenueData,
  'active-users': {
    value: 2841, change: '+6.2%', note: 'active today', shortNote: 'today',
    days: [32, 37, 36, 38, 41, 24, 48, 34, 36, 35, 39, 40, 27, 48].map((value, index) => ({ label: 'MTWTFSS'[index % 7] ?? '', value })),
  } satisfies ActiveUsersData,
  activity: {
    latestWhen: 'Today, 09:41',
    events: [{ text: 'Release 4.2 promoted to production', time: '09:41' }, { text: 'Invoice 2041 paid', time: '09:12' }, { text: 'New teammate joined Design', time: '08:55' }, { text: 'Nightly backup verified', time: 'Mon' }],
  } satisfies ActivityData,
  notes: {
    title: 'Q4 planning',
    featured: ['pricing', 'review', 'hiring'],
    items: [
      { id: 'roadmap', text: 'Draft Q4 roadmap', done: true }, { id: 'pricing', text: 'Pick pricing experiment', done: true }, { id: 'hiring', text: 'Share hiring plan', done: false },
      { id: 'onboarding', text: 'Review onboarding copy', done: true }, { id: 'review', text: 'Book design review', done: false },
    ],
  } satisfies NotesData,
  uptime: { value: 99.98, summary: 'All systems normal', incident: 18, incidentNote: 'One incident 18 days ago: slower API responses for 4 minutes.' } satisfies UptimeData,
  storage: { used: 342, total: 500, parts: [{ label: 'Media', size: 182 }, { label: 'Documents', size: 96 }, { label: 'Backups', size: 64 }] } satisfies StorageData,
}

type Base = {
  /** Default `small`: the number. `medium` adds the chart or list, `large` adds the breakdown. */
  size?: BentoWidgetSize
  /** Replaces the six dots, as Bento Grid does with its move control. */
  grip?: ReactNode
  /** Fills its cell instead of the width of its size. */
  fill?: boolean
  /** Shows the Hover look without a pointer, for previews. */
  hovered?: boolean
  animated?: boolean
  className?: string | undefined
}

export type BentoWidgetProps = Base & (
  | { widget: 'revenue'; data?: RevenueData }
  | { widget: 'active-users'; data?: ActiveUsersData }
  | { widget: 'activity'; data?: ActivityData }
  | { widget: 'notes'; data?: NotesData; onItemsChange?: (items: NoteItem[]) => void }
  | { widget: 'uptime'; data?: UptimeData }
  | { widget: 'storage'; data?: StorageData }
)

const LABEL: Record<BentoWidgetKind, [string, ComponentType<{ size?: number }>]> = {
  revenue: ['Revenue', ActivityIcon], 'active-users': ['Active users', UserIcon], activity: ['Activity', ClockIcon], notes: ['Notes', FileTextIcon], uptime: ['Uptime', ActivityIcon], storage: ['Storage', HardDriveIcon],
}

/** The six dots of a grip. */
export const BentoGripDots = () => <span className={styles.dots} aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</span>

function Spark({ points, still }: { points: number[]; still: boolean }) {
  const step = 408 / (points.length - 1)
  const line = points.map((y, index) => `${index ? 'L' : 'M'} ${index * step} ${y + 4}`).join(' ')
  return (
    <svg className={styles.spark} viewBox="0 0 408 40" preserveAspectRatio="none" aria-hidden="true">
      <motion.path className={styles.area} d={`${line} L 408 40 L 0 40 Z`} initial={still ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={arrive(still)} />
      <motion.path className={styles.line} d={line} initial={still ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={arrive(still)} />
    </svg>
  )
}

function Revenue({ data, size, still }: { data: RevenueData; size: BentoWidgetSize; still: boolean }) {
  const main = (
    <>
      <p className={styles.value}><CountUp value={data.value} format={money} still={still} /></p>
      <p className={styles.delta}><span className={styles.change}>{data.change}</span><span className={styles.meta}>{data.note}</span></p>
    </>
  )
  if (size === 'small') return <><span className={styles.push} />{main}</>
  const chart = <><span className={styles.gap2} /><Spark points={data.points} still={still} /></>
  if (size === 'medium') return <>{main}{chart}</>
  return (
    <div className={styles.split}>
      <div className={styles.main}>{main}{chart}</div>
      <dl className={styles.breakdown}>
        {data.breakdown.map(({ label, amount }) => <div key={label} className={styles.breakdownRow}><dt>{label}</dt><dd>{amount}</dd></div>)}
      </dl>
    </div>
  )
}

function ActiveUsers({ data, size, still }: { data: ActiveUsersData; size: BentoWidgetSize; still: boolean }) {
  if (size === 'small') {
    return <><span className={styles.push} /><p className={styles.value}><CountUp value={data.value} format={whole} still={still} /></p><p className={styles.delta}><span className={styles.change}>{data.change}</span><span className={styles.meta}>{data.shortNote}</span></p></>
  }
  const days = size === 'medium' ? data.days.slice(0, 7) : data.days
  const top = Math.max(...days.map(({ value }) => value))
  return (
    <>
      <div className={styles.valueRow}>
        <p className={styles.value}><CountUp value={data.value} format={whole} still={still} /></p>
        <p className={styles.delta}><span className={styles.change}>{data.change}</span><span className={styles.meta}>{data.note}</span></p>
      </div>
      <span className={styles.push} />
      <div className={styles.bars} aria-hidden="true">
        {days.map(({ value }, index) => (
          <motion.span key={index} className={styles.bar} data-now={index === days.length - 1 ? '' : undefined} style={{ height: `${(value / top) * 100}%` }} initial={still ? false : { scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={arrive(still, index * BAR_STAGGER)} />
        ))}
      </div>
      <div className={styles.days} aria-hidden="true">{days.map(({ label }, index) => <span key={index}>{label}</span>)}</div>
    </>
  )
}

function Activity({ data, size }: { data: ActivityData; size: BentoWidgetSize }) {
  const [latest] = data.events
  if (size === 'small') {
    return (
      <>
        <span className={styles.push} />
        <p className={styles.latest}><i className={styles.dot} data-solid="" /><span>{latest?.text}</span></p>
        <p className={cx(styles.meta, styles.when)}>{data.latestWhen}</p>
      </>
    )
  }
  return (
    <>
      <span className={styles.push} />
      <ol className={styles.events}>
        {data.events.slice(0, size === 'medium' ? 3 : 4).map(({ text, time }, index) => (
          <li key={text} className={styles.event}><i className={styles.dot} data-solid={index === 0 ? '' : undefined} /><span className={styles.eventText}>{text}</span><time className={styles.time}>{time}</time></li>
        ))}
      </ol>
    </>
  )
}

function Notes({ data, size, animated, onItemsChange }: { data: NotesData; size: BentoWidgetSize; animated: boolean; onItemsChange?: ((items: NoteItem[]) => void) | undefined }) {
  const [items, setItems] = useState(data.items)
  const done = items.filter((item) => item.done).length
  if (size === 'small') {
    return (
      <>
        <span className={styles.push} />
        <p className={styles.noteTitle}>{data.title}</p>
        <p className={styles.meta}>{done} of {items.length} done</p>
        <span className={styles.track} data-thin="" role="progressbar" aria-label={data.title} aria-valuenow={done} aria-valuemin={0} aria-valuemax={items.length}>
          <i className={styles.fill} style={{ transform: `scaleX(${done / items.length})` }} />
        </span>
      </>
    )
  }
  function toggle(id: string, next: boolean): void {
    const changed = items.map((item) => (item.id === id ? { ...item, done: next } : item))
    setItems(changed)
    onItemsChange?.(changed)
  }
  const todo = (item: NoteItem) => (
    <li key={item.id}>
      <label className={styles.todo} data-done={item.done ? '' : undefined}>
        <Checkbox checked={item.done} onCheckedChange={(next) => toggle(item.id, next)} animated={animated} />
        <span className={styles.todoText}>{item.text}</span>
      </label>
    </li>
  )
  if (size === 'medium') {
    const shown = (data.featured ?? items.slice(0, 3).map(({ id }) => id)).flatMap((id) => items.filter((item) => item.id === id))
    return <><span className={styles.push} /><ul className={styles.todos}>{shown.map(todo)}</ul></>
  }
  return <><span className={styles.push} /><ul className={styles.todos} data-columns="">{items.map(todo)}</ul></>
}

function Uptime({ data, size, still }: { data: UptimeData; size: BentoWidgetSize; still: boolean }) {
  if (size === 'small') return <><span className={styles.push} /><p className={styles.value}><CountUp value={data.value} format={percent} still={still} /></p><p className={styles.meta}>{data.summary}</p></>
  const days = size === 'medium' ? 30 : 45
  return (
    <>
      <span className={styles.push} />
      <div className={styles.valueRow}>
        <p className={styles.valueSm}><CountUp value={data.value} format={percent} still={still} /></p>
        <p className={styles.meta}>last {days} days</p>
      </div>
      <div className={styles.uptime} role="img" aria-label={`${days} days. ${data.incidentNote}`} data-size={size}>
        {Array.from({ length: days }, (_, index) => <span key={index} className={styles.day} data-incident={index === days - 1 - data.incident ? '' : undefined} />)}
      </div>
      {size === 'large' ? <p className={cx(styles.meta, styles.incident)}>{data.incidentNote}</p> : null}
    </>
  )
}

function Storage({ data, size, still }: { data: StorageData; size: BentoWidgetSize; still: boolean }) {
  const value = (
    <div className={styles.valueRow} data-tight="">
      <p className={styles.valueSm}><CountUp value={data.used} format={gigabytes} still={still} /></p>
      <p className={styles.meta}>of {data.total}</p>
    </div>
  )
  const share = data.used / data.total
  if (size === 'small') {
    return (
      <>
        <span className={styles.push} />
        {value}
        <span className={styles.track} role="progressbar" aria-label="Storage used" aria-valuenow={data.used} aria-valuemin={0} aria-valuemax={data.total}>
          <motion.i className={styles.fill} initial={still ? false : { scaleX: 0 }} {...(still ? { animate: { scaleX: share } } : { whileInView: { scaleX: share }, viewport: { once: true } })} transition={arrive(still)} />
        </span>
      </>
    )
  }
  return (
    <>
      <span className={styles.push} />
      {value}
      <div className={styles.segments} aria-hidden="true">
        {data.parts.map(({ label, size: part }, index) => <span key={label} className={styles.segment} data-step={index} style={{ width: `${(part / data.total) * 100}%` }} />)}
      </div>
      <ul className={styles.legend}>
        {data.parts.map(({ label, size: part }, index) => (
          <li key={label} className={styles.key}><i className={styles.keyDot} data-step={index} /><span className={styles.meta}>{label}</span><strong className={styles.keySize} data-size={size}>{part} GB</strong></li>
        ))}
      </ul>
    </>
  )
}

function WidgetBody(props: BentoWidgetProps & { size: BentoWidgetSize; still: boolean; animated: boolean }) {
  const { size, still, animated } = props
  switch (props.widget) {
    case 'revenue': return <Revenue data={props.data ?? BENTO_DATA.revenue} size={size} still={still} />
    case 'active-users': return <ActiveUsers data={props.data ?? BENTO_DATA['active-users']} size={size} still={still} />
    case 'activity': return <Activity data={props.data ?? BENTO_DATA.activity} size={size} />
    case 'notes': return <Notes data={props.data ?? BENTO_DATA.notes} size={size} animated={animated} onItemsChange={props.onItemsChange} />
    case 'uptime': return <Uptime data={props.data ?? BENTO_DATA.uptime} size={size} still={still} />
    default: return <Storage data={props.data ?? BENTO_DATA.storage} size={size} still={still} />
  }
}

/** One dashboard tile: six widgets in three sizes, in ink steps, with a grip for moving it. */
export function BentoWidget(props: BentoWidgetProps) {
  const { size = 'small', grip, fill = false, hovered = false, animated = true, className } = props
  const still = useStill(animated)
  const labelId = useId()
  const [name, Icon] = LABEL[props.widget]
  return (
    <Card
      variant="plain"
      role="region"
      aria-labelledby={labelId}
      className={cx(styles.widget, className)}
      bodyClassName={styles.body}
      data-size={size}
      data-widget={props.widget}
      data-fill={fill ? '' : undefined}
      data-hovered={hovered ? '' : undefined}
      data-still={still ? '' : undefined}
      animated={animated}
    >
      <div className={styles.inner}>
        <div className={styles.top}>
          <p className={styles.label} id={labelId}><Icon size={14} />{name}</p>
          <span className={styles.grip}>{grip ?? <BentoGripDots />}</span>
        </div>
        <WidgetBody {...props} size={size} still={still} animated={animated} />
      </div>
    </Card>
  )
}
