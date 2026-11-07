'use client'
import { MessageIcon } from '@fetaui/react/rounded/message'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { useMemo, useState, type CSSProperties, type HTMLAttributes } from 'react'
import { Avatar, type AvatarPerson } from '../avatar/avatar'
import { Badge, type BadgeTone } from '../badge/badge'
import { Button } from '../button/button'
import { cx } from '../motion-kit/motion-kit'
import { Tabs } from '../tabs/tabs'
import { VoteButton } from '../vote-button/vote-button'
import styles from './feature-voting.module.css'

const STAGGER_MS = 40

export type FeatureStatus = 'Planned' | 'In progress' | 'Shipped' | 'Under review'

const STATUS_TONE: Record<FeatureStatus, BadgeTone> = { Planned: 'info', 'In progress': 'warning', Shipped: 'success', 'Under review': 'neutral' }

export type FeatureRequest = {
  id: string
  title: string
  description?: string
  /** Total votes, including this person's. */
  votes: number
  /** This person has voted. */
  voted?: boolean
  status: FeatureStatus
  comments: number
  category?: string
  author?: { name: string; person?: AvatarPerson; ago: string }
  /** Days old, for the New tab. */
  age?: number
  /** Votes this week, for the Trending tab. */
  momentum?: number
}

export type FeatureVotingProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** Compact is a short top list. Board adds descriptions, categories and authors. Default `compact`. */
  styleKind?: 'compact' | 'board'
  title: string
  description?: string
  items: FeatureRequest[]
  /** The button in the header. */
  suggestLabel?: string
  /** The same button on Mobile. Default `Suggest`. */
  suggestShortLabel?: string
  onSuggest?: () => void
  /** Default `Vote on what your team needs most.`. */
  footer?: string
  onVote?: (id: string, voted: boolean) => void
  animated?: boolean
}

type Tab = { value: string; label: string; filter?: FeatureStatus; sort?: (a: FeatureRequest, b: FeatureRequest) => number }

const TOP = (a: FeatureRequest, b: FeatureRequest): number => b.votes - a.votes

/** A feature request board: vote counters, status and comments, filtered by tabs. */
export function FeatureVoting({ styleKind = 'compact', title, description, items, suggestLabel = 'Suggest a feature', suggestShortLabel = 'Suggest', onSuggest, footer = 'Vote on what your team needs most.', onVote, animated = true, className, ...rest }: FeatureVotingProps) {
  const board = styleKind === 'board'
  const tabs = useMemo<Tab[]>(() => {
    if (!board) return [{ value: 'top', label: 'Top', sort: TOP }, { value: 'new', label: 'New', sort: (a, b) => (a.age ?? 0) - (b.age ?? 0) }, { value: 'trending', label: 'Trending', sort: (a, b) => (b.momentum ?? 0) - (a.momentum ?? 0) }]
    const count = (status: FeatureStatus): number => items.filter((item) => item.status === status).length
    return [{ value: 'all', label: `All ${items.length}`, sort: TOP }, ...(['Under review', 'Planned', 'In progress'] as const).map((filter) => ({ value: filter, label: `${filter} ${count(filter)}`, filter, sort: TOP }))]
  }, [board, items])
  const [tab, setTab] = useState(tabs[0]?.value ?? 'top')
  const [mine, setMine] = useState<Record<string, boolean>>({})
  const active = tabs.find(({ value }) => value === tab) ?? tabs[0]
  const shown = items.filter((item) => !active?.filter || item.status === active.filter).sort(active?.sort ?? TOP)
  const total = items.reduce((sum, { votes }) => sum + votes, 0)

  return (
    <section data-style={styleKind} data-still={animated ? undefined : ''} className={cx(styles.voting, className)} {...rest}>
      <header className={styles.header}>
        <div className={styles.top}>
          <div className={styles.titles}>
            <h3 className={styles.title}>{title}</h3>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          <Button className={styles.long} size="sm" leadingIcon={<PlusIcon />} animated={animated} {...(onSuggest ? { onClick: onSuggest } : {})}>{suggestLabel}</Button>
          <Button className={styles.short} size="sm" leadingIcon={<PlusIcon />} animated={animated} {...(onSuggest ? { onClick: onSuggest } : {})}>{suggestShortLabel}</Button>
        </div>
        <div className={styles.tabs}>
          <Tabs items={tabs.map(({ value, label }) => ({ value, label }))} value={tab} onValueChange={setTab} label="Sort requests" animated={animated} />
          {board ? null : <span className={styles.total}>{total.toLocaleString('en-US')} votes</span>}
        </div>
      </header>
      <ol key={tab} className={styles.list}>
        {shown.map((item, i) => (
          <li key={item.id} className={styles.row} style={{ '--i': `${i * STAGGER_MS}ms` } as CSSProperties}>
            <VoteButton count={item.votes - (item.voted ? 1 : 0)} voted={mine[item.id] ?? item.voted ?? false} label={`Vote for ${item.title}`} animated={animated} onVotedChange={(voted) => { setMine((all) => ({ ...all, [item.id]: voted })); onVote?.(item.id, voted) }} />
            <div className={styles.text}>
              <div className={styles.name}>{item.title}</div>
              {board && item.description ? <div className={styles.summary}>{item.description}</div> : null}
              <div className={styles.meta}>
                <Badge size="sm" tone={STATUS_TONE[item.status]} animated={animated}>{item.status}</Badge>
                {board && item.category ? <span className={styles.category}>{item.category}</span> : null}
                <span className={styles.comments} aria-label={`${item.comments} comments`}><MessageIcon size={14} />{item.comments}</span>
                {board && item.author ? <span className={styles.author}><Avatar size="xs" {...(item.author.person ? { person: item.author.person } : { initials: item.author.name.slice(0, 1) })} animated={animated} />{item.author.name} · {item.author.ago}</span> : null}
              </div>
            </div>
          </li>
        ))}
      </ol>
      <footer className={styles.footer}>{footer}</footer>
    </section>
  )
}
