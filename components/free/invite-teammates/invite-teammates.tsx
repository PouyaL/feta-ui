'use client'
import { motion } from 'motion/react'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircleIcon } from '@fetaui/react/rounded/alert-circle'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { RotateCcwIcon } from '@fetaui/react/rounded/rotate-ccw'
import { SendIcon } from '@fetaui/react/rounded/send'
import { XIcon } from '@fetaui/react/rounded/x'
import type { AvatarPerson } from '../avatar/avatar'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { Input } from '../input/input'
import { RollingText, cx, useStill } from '../motion-kit/motion-kit'
import { Avatar, AvatarStack, enter, kit, rowEnter } from '../product-kit/product-kit'
import styles from './invite-teammates.module.css'

export type PendingTeammate = { id: string; name: string; email: string; role: string; sent: string; person?: AvatarPerson }

export type InviteTeammatesProps = {
  workspace: string
  plan: string
  seats: number
  /** Members already seated. */
  members: number
  pending?: PendingTeammate[]
  people?: string[]
  /** Fills the field from Paste a sample list. */
  sample?: string
  defaultValue?: string
  upgradeLabel?: string
  onSend?: (entries: string[]) => void
  onUpgrade?: () => void
  onResend?: (id: string) => void
  onRevoke?: (id: string) => void
  animated?: boolean
  className?: string
}

/** Names hold spaces, so only commas, semicolons and new lines separate entries. */
const splitEntries = (text: string): string[] => text.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean)

function Key({ tone, children }: { tone: 'members' | 'pending' | 'new' | 'over'; children: ReactNode }) {
  return <li className={styles.key}><span className={styles.keyDot} data-tone={tone} aria-hidden="true" />{children}</li>
}

/** An invite panel: names or emails, a seat bar split by members, pending and new, and the pending list. */
/** How long the spinner shows before the check, in ms. */
const SEND_MS = 900

export function InviteTeammates({ workspace, plan, seats, members, pending = [], people, sample, defaultValue = '', upgradeLabel = 'Upgrade to Team', onSend, onUpgrade, onResend, onRevoke, animated = true, className }: InviteTeammatesProps) {
  // Sending shows the spinner, then a check, then the button rests. Each Resend has its own state.
  const [sendStatus, setSendStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [resending, setResending] = useState<Record<string, 'loading' | 'success'>>({})
  const sentCount = useRef(0)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const resendTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  useEffect(() => () => { clearTimeout(sendTimer.current); Object.values(resendTimers.current).forEach(clearTimeout) }, [])
  const still = useStill(animated)
  const uid = useId()
  const [text, setText] = useState(defaultValue)
  const entries = useMemo(() => splitEntries(text), [text])
  const held = members + pending.length
  const used = held + entries.length
  const over = used > seats
  const left = Math.max(0, seats - held)
  const scale = Math.max(seats, used)
  const parts = [{ name: 'members', size: members }, { name: 'pending', size: pending.length }, { name: over ? 'over' : 'new', size: entries.length }, { name: 'free', size: scale - used }]

  return (
    <motion.section {...enter(still)} className={cx(kit.tray, styles.tray, className)} aria-label="Invite teammates">
      <div className={kit.body}>
        <div className={kit.section}>
          <header className={styles.header}>
            <div>
              <h2 className={kit.title}>Invite teammates</h2>
              <p className={kit.sub}>Add people to {workspace} by name or email</p>
            </div>
            {people ? <span className={styles.people}><AvatarStack names={people} animated={animated} /></span> : null}
          </header>

          <div className={styles.field}>
            <Input value={text} invalid={over} placeholder="Name or email" aria-label="Names or emails" aria-describedby={`${uid}-help`} animated={animated} onChange={(e) => setText(e.target.value)} />
            {over ? <span className={styles.alert}><AlertCircleIcon size={16} /></span> : null}
          </div>
          <div className={styles.helpRow}>
            {over ? <p id={`${uid}-help`} role="alert" className={styles.error}>Only {left} {left === 1 ? 'seat' : 'seats'} left on {plan.replace(/ plan$/, '')}. Remove one or upgrade.</p> : <p id={`${uid}-help`} className={styles.help}>Separate with commas, or paste a whole list</p>}
            {sample && !over ? <span className={styles.sample}><Button variant="link" size="sm" animated={animated} leadingIcon={<CopyIcon size={12} />} onClick={() => setText(sample)}>Paste a sample list</Button></span> : null}
          </div>

          <div className={styles.usage} role="group" aria-label="Seats">
            <div className={styles.usageHead}>
              <span className={styles.total} data-over={over ? '' : undefined}><b><RollingText value={String(used)} still={still} /></b> of {seats} seats</span>
              <span className={kit.tertiary}>{plan}</span>
            </div>
            <div className={styles.bar} aria-hidden="true">
              {parts.map((part) => part.size > 0 ? <span key={part.name} className={styles.segment} data-part={part.name} style={{ flexGrow: part.size }} /> : null)}
            </div>
            <ul className={styles.keys}>
              <Key tone="members">{members} members</Key>
              <Key tone="pending">{pending.length} pending</Key>
              <Key tone={over ? 'over' : 'new'}>{entries.length} new</Key>
            </ul>
          </div>

          <div className={styles.actions}>
            <IconButton variant="ghost" size="sm" animated={animated} label="Clear" disabled={!text} icon={<RotateCcwIcon size={16} />} onClick={() => setText('')} />
            {over
              ? <Button variant="secondary" shape="pill" animated={animated} onClick={onUpgrade}>{upgradeLabel}</Button>
              : <Button shape="pill" animated={animated} leadingIcon={<SendIcon size={16} />} disabled={entries.length === 0 && sendStatus === 'idle'} status={sendStatus} loadingLabel="Sending" successLabel={`${sentCount.current} sent`} onSuccessEnd={() => setSendStatus('idle')} onClick={() => {
                  if (sendStatus !== 'idle') return
                  sentCount.current = entries.length
                  onSend?.(entries)
                  setSendStatus('loading')
                  sendTimer.current = setTimeout(() => { setSendStatus('success'); setText('') }, SEND_MS)
                }}>Send invites</Button>}
          </div>
        </div>

        {pending.length ? (
          <div className={kit.section}>
            <h3 className={styles.pendingTitle}>Pending <span className={styles.count}>{pending.length}</span></h3>
            <ul className={styles.list}>
              {pending.map((person, index) => (
                <motion.li key={person.id} {...rowEnter(still, index)} className={styles.person}>
                  <Avatar name={person.name} person={person.person} size={36} animated={animated} />
                  <div className={styles.who}>
                    <span className={styles.name}>{person.name}</span>
                    <span className={styles.detail}>{person.role} · {person.email}</span>
                  </div>
                  <span className={styles.sent}>Sent {person.sent}</span>
                  <Button variant="ghost" size="sm" animated={animated} aria-label={`Resend to ${person.name}`} status={resending[person.id] ?? 'idle'} loadingLabel="Sending" successLabel="Sent" onSuccessEnd={() => setResending(({ [person.id]: _, ...rest }) => rest)} onClick={() => {
                    if (resending[person.id]) return
                    onResend?.(person.id)
                    setResending((now) => ({ ...now, [person.id]: 'loading' }))
                    resendTimers.current[person.id] = setTimeout(() => setResending((now) => ({ ...now, [person.id]: 'success' })), SEND_MS)
                  }}>Resend</Button>
                  <IconButton variant="ghost" size="sm" animated={animated} label={`Revoke ${person.name}`} icon={<XIcon size={16} />} onClick={() => onRevoke?.(person.id)} />
                </motion.li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </motion.section>
  )
}
