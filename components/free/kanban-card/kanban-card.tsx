'use client'
import { motion } from 'motion/react'
import { type ComponentProps, type ReactNode } from 'react'
import { CalendarIcon } from '@fetaui/react/rounded/calendar'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { CheckCheckIcon } from '@fetaui/react/rounded/check-check'
import { MessageIcon } from '@fetaui/react/rounded/message'
import type { AvatarPerson } from '../avatar/avatar'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Avatar, EASE_STANDARD, ROW_S, Tag, type TagTone } from '../product-kit/product-kit'
import styles from './kanban-card.module.css'

export type KanbanCardAssigneeProps = { name: string; src?: string | undefined; person?: AvatarPerson | undefined }

export type KanbanCardProps = Omit<ComponentProps<'article'>, 'title' | 'id'> & {
  /** The tracker id, shown in mono. */
  id: string
  title: string
  tag?: { label: string; tone?: TagTone }
  assignee?: KanbanCardAssigneeProps
  due?: string
  comments?: number
  subtasks?: [done: number, total: number]
  done?: boolean
  /** Forces a pose. Hover is otherwise live. `lifted` is a keyboard pick up, `placeholder` dims the spot a dragged card left. */
  state?: 'hover' | 'dragging' | 'lifted' | 'placeholder'
  /** Replaces the tag and id row. `null` drops the row. */
  top?: ReactNode
  /** Replaces the assignee, due, comments and subtasks row. `null` drops the row. */
  meta?: ReactNode
  /** `compact` is 12 padding on a 14 radius, for dense boards. Default `default`. */
  density?: 'default' | 'compact'
  /** Props for a full card button laid over the content, for keyboard pick up and a grab cursor. The card stays free of drag logic. */
  handle?: Omit<ComponentProps<'button'>, 'type' | 'children' | 'className'>
  /** `false` skips the fade in, for a parent that runs its own entrance. Default `true`. */
  appear?: boolean
  animated?: boolean
}

/** One stat: an icon, a spoken label and the short visible value. */
export function KanbanCardStat({ icon, label, mono, children }: { icon?: ReactNode; label: string; mono?: boolean; children: ReactNode }) {
  return <span className={styles.stat} data-mono={mono ? '' : undefined}>{icon}<span className={styles.sr}>{label}</span><span aria-hidden="true">{children}</span></span>
}

/** The 20 px assignee avatar, announced as who it is assigned to. */
export function KanbanCardAssignee({ name, src, person, animated = true }: KanbanCardAssigneeProps & { animated?: boolean }) {
  return <span className={styles.assignee} title={name}><span className={styles.sr}>Assigned to {name}</span><Avatar name={name} src={src} person={person} size={20} animated={animated} /></span>
}

/** One card: tag and id, a two line title, then assignee, due date, comments and subtasks. */
export function KanbanCard({ id, title, tag, assignee, due, comments, subtasks, done, state, top, meta, density = 'default', handle, appear = true, animated = true, className, ...rest }: KanbanCardProps) {
  const still = useStill(animated)
  return (
    <motion.div className={styles.enter} initial={still || !appear ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: ROW_S, ease: EASE_STANDARD }}>
      <article {...rest} className={cx(styles.card, className)} data-state={state} data-done={done ? '' : undefined} data-still={still ? '' : undefined} data-density={density === 'default' ? undefined : density} data-handle={handle ? '' : undefined}>
        {handle ? <button type="button" {...handle} className={styles.handle} /> : null}
        {top === undefined ? (
          <div className={styles.top}>
            {tag ? <Tag tone={tag.tone ?? 'neutral'} dot animated={animated}>{tag.label}</Tag> : null}
            <span className={styles.id}>{id}</span>
          </div>
        ) : top === null || top === false ? null : <div className={styles.top}>{top}</div>}
        <div className={styles.titleRow}>
          {done ? <span className={styles.check}><CheckIcon size={16} aria-label="Done" /></span> : null}
          <h4 className={styles.title}>{title}</h4>
        </div>
        {meta === undefined ? (
          <div className={styles.meta}>
            {assignee ? <KanbanCardAssignee {...assignee} animated={animated} /> : null}
            {due ? <KanbanCardStat icon={<CalendarIcon size={12} />} label={`Due ${due}`}>{due}</KanbanCardStat> : null}
            {comments === undefined ? null : <KanbanCardStat icon={<MessageIcon size={12} />} label={`${comments} comments`}>{comments}</KanbanCardStat>}
            {subtasks ? <span className={styles.end}><KanbanCardStat mono icon={<CheckCheckIcon size={12} />} label={`${subtasks[0]} of ${subtasks[1]} subtasks`}>{subtasks[0]}/{subtasks[1]}</KanbanCardStat></span> : null}
          </div>
        ) : meta === null || meta === false ? null : <div className={styles.meta}>{meta}</div>}
      </article>
    </motion.div>
  )
}
