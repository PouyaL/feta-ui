'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState, type CSSProperties } from 'react'
import { ArchiveIcon } from '@fetaui/react/rounded/archive'
import { CheckCheckIcon } from '@fetaui/react/rounded/check-check'
import { FilterIcon } from '@fetaui/react/rounded/filter'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { TrashIcon } from '@fetaui/react/rounded/trash'
import { Button } from '../button/button'
import { Checkbox } from '../checkbox/checkbox'
import { DropdownMenu } from '../dropdown-menu/dropdown-menu'
import { IconButton } from '../icon-button/icon-button'
import { useStill } from '../motion-kit/motion-kit'
import { ease } from '../../motion-tokens'
import { Initials, Panel, Tag, Tween, kit, useWindow, type Tone } from '../data-kit/data-kit'
import styles from './inbox-bulk-actions.module.css'

const BAR_S = 0.2
const ROW_HEIGHT = 56
/** Past this many messages the list scrolls in a window and only nearby rows render. */
const WINDOW_AFTER = 50
const VIEWPORT = 420

export type InboxMessage = { id: string; from: string; subject: string; time: string; label?: string; tone?: Tone; unread?: boolean }

export type InboxBulkActionsProps = {
  messages: InboxMessage[]
  title?: string
  defaultSelected?: string[]
  onArchive?: (ids: string[]) => void
  onMarkRead?: (ids: string[]) => void
  onDelete?: (ids: string[]) => void
  animated?: boolean
  className?: string
}

/** A message list. Selecting rows swaps the header for a bulk toolbar. Long lists render a window of rows. */
export function InboxBulkActions({ messages, title = 'Inbox', defaultSelected = [], onArchive, onMarkRead, onDelete, animated = true, className }: InboxBulkActionsProps) {
  const still = useStill(animated)
  const [picked, setPicked] = useState(defaultSelected)
  const [gone, setGone] = useState<string[]>([])
  const [read, setRead] = useState<string[]>([])
  const [unreadOnly, setUnreadOnly] = useState(false)
  const list = useMemo(() => messages.filter((message) => !gone.includes(message.id) && (!unreadOnly || (message.unread && !read.includes(message.id)))), [messages, gone, unreadOnly, read])
  const long = list.length > WINDOW_AFTER
  const { first, last, total, onScroll } = useWindow(list.length, ROW_HEIGHT, VIEWPORT)
  const rows = long ? list.slice(first, last) : list
  const bulk = picked.length > 0
  const all = list.length > 0 && picked.length === list.length
  const remove = (run?: (ids: string[]) => void): void => { run?.(picked); setGone((was) => [...was, ...picked]); setPicked([]) }
  const swap = { initial: still ? { opacity: 0 } : { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, exit: still ? { opacity: 0 } : { opacity: 0, y: -4 }, transition: { duration: still ? 0 : BAR_S, ease: ease.out } }

  return (
    <Panel width={640} animated={animated} className={className} label={title}>
      <div className={styles.head} data-bulk={bulk ? '' : undefined}>
        <Checkbox aria-label="Select all" checked={all} indeterminate={bulk && !all} onCheckedChange={(on) => setPicked(on ? list.map((message) => message.id) : [])} animated={animated} />
        <AnimatePresence mode="popLayout" initial={false}>
          {bulk ? (
            <motion.div key="bulk" {...swap} className={styles.bar} role="toolbar" aria-label="Bulk actions">
              <span className={styles.title}><Tween value={picked.length} format={(v) => String(Math.round(v))} animated={animated} /> selected</span>
              <span className={styles.actions}>
                <Button variant="secondary" size="sm" shape="pill" leadingIcon={<ArchiveIcon size={14} />} onClick={() => remove(onArchive)} animated={animated}>Archive</Button>
                <Button variant="secondary" size="sm" shape="pill" leadingIcon={<CheckCheckIcon size={14} />} className={styles.wideOnly ?? ''} onClick={() => { onMarkRead?.(picked); setRead((was) => [...was, ...picked]); setPicked([]) }} animated={animated}>Mark read</Button>
                <IconButton variant="ghost" size="sm" label="Delete" icon={<TrashIcon size={16} />} onClick={() => remove(onDelete)} animated={animated} />
              </span>
            </motion.div>
          ) : (
            <motion.div key="title" {...swap} className={styles.bar}>
              <span className={styles.titles}><span className={styles.title}>{title}</span><span className={styles.count}>{list.length.toLocaleString('en-US')} conversations</span></span>
              <span className={styles.actions}>
                <IconButton variant="ghost" size="sm" label="Show unread only" aria-pressed={unreadOnly} icon={<FilterIcon size={16} />} onClick={() => setUnreadOnly(!unreadOnly)} animated={animated} />
                <DropdownMenu label="Inbox actions" align="end" animated={animated} entries={[{ label: 'Mark all read', onSelect: () => { const ids = list.map((message) => message.id); onMarkRead?.(ids); setRead((was) => [...was, ...ids]) } }]} trigger={(props) => <IconButton {...props} variant="ghost" size="sm" label="Inbox actions" icon={<MoreHorizontalIcon size={16} />} animated={animated} />} />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <ul className={styles.list} data-long={long ? '' : undefined} style={long ? { height: VIEWPORT, overflowY: 'auto' } : undefined} onScroll={long ? onScroll : undefined} aria-label="Messages">
        {long ? <li aria-hidden="true" style={{ height: first * ROW_HEIGHT }} /> : null}
        {rows.map((message, i) => {
          const on = picked.includes(message.id)
          const unread = message.unread && !read.includes(message.id)
          return (
            <li key={message.id} className={`${styles.row} ${long ? '' : kit.row}`} style={{ '--i': i } as CSSProperties} data-selected={on ? '' : undefined} data-unread={unread ? '' : undefined}>
              <Checkbox aria-label={`Select message from ${message.from}`} checked={on} onCheckedChange={(next) => setPicked((was) => (next ? [...was, message.id] : was.filter((id) => id !== message.id)))} animated={animated} />
              <Initials name={message.from} size="sm" />
              <span className={styles.text}>
                <span className={styles.from}>{message.from}</span>
                <span className={styles.subjectLine}>{message.label ? <Tag tone={message.tone ?? 'neutral'} mark className={styles.label}>{message.label}</Tag> : null}<span className={styles.subject}>{message.subject}</span></span>
                <time className={styles.time}>{message.time}</time>
              </span>
            </li>
          )
        })}
        {long ? <li aria-hidden="true" style={{ height: total - last * ROW_HEIGHT }} /> : null}
      </ul>
    </Panel>
  )
}
