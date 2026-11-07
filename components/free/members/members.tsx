'use client'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { UserMinusIcon } from '@fetaui/react/rounded/user-minus'
import type { AvatarPerson } from '../avatar/avatar'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { Input } from '../input/input'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Select } from '../select/select'
import { Avatar, Meter, SeatCount, enter, kit, rowEnter } from '../product-kit/product-kit'
import { SearchField } from '../search/search'
import { isEmail, splitEmails } from '../invite-field/invite-field'
import styles from './members.module.css'

export type Member = { id: string; name: string; email: string; role: string; activity: string; you?: boolean; online?: boolean; src?: string; person?: AvatarPerson }
export type PendingInvite = { id: string; email: string; role: string; invited: string }

export type MembersProps = {
  workspace: string
  seats: number
  members: Member[]
  pending?: PendingInvite[]
  roles?: string[]
  defaultRole?: string
  /** The text already typed into the invite field. */
  defaultDraft?: string
  onInvite?: (emails: string[], role: string) => void
  onRoleChange?: (memberId: string, role: string) => void
  onRemove?: (memberId: string) => void
  onResend?: (inviteId: string) => void
  onRevoke?: (inviteId: string) => void
  animated?: boolean
  className?: string
}

/** Workspace members: seat usage, an invite row, the member list and pending invites. */
export function Members({ workspace, seats, members, pending = [], roles = ['Admin', 'Member', 'Viewer'], defaultRole = 'Member', defaultDraft = '', onInvite, onRoleChange, onRemove, onResend, onRevoke, animated = true, className }: MembersProps) {
  const still = useStill(animated)
  const [draft, setDraft] = useState(defaultDraft)
  const [role, setRole] = useState(defaultRole)
  const [query, setQuery] = useState('')
  // How many invites the last send carried, 0 once its success has shown.
  const [sent, setSent] = useState(0)
  const emails = useMemo(() => splitEmails(draft), [draft])
  const canSend = emails.length > 0 && emails.every(isEmail)
  const used = members.length + pending.length + emails.length
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(q)) : members
  }, [members, query])

  return (
    <motion.section {...enter(still)} className={cx(kit.tray, styles.tray, className)} aria-label="Members">
      <div className={kit.body}>
        <header className={cx(kit.section, styles.header)}>
          <div className={styles.heading}>
            <h2 className={kit.title}>Members</h2>
            <p className={kit.sub}>Manage who can work in the {workspace} workspace.</p>
          </div>
          <div className={styles.seats}><SeatCount used={used} total={seats} still={still} /><Meter value={used} max={seats} label={`${used} of ${seats} seats`} animated={animated} /></div>
        </header>

        <form className={cx(kit.section, styles.invite)} onSubmit={(e) => { e.preventDefault(); if (canSend) { onInvite?.(emails, role); setDraft(''); setSent(emails.length) } }}>
          <h3 className={styles.sectionTitle}>Invite people</h3>
          <div className={styles.inviteRow}>
            <Input className={styles.email} value={draft} placeholder="name@example.com" aria-label="Email addresses" animated={animated} onChange={(e) => setDraft(e.target.value)} />
            <Select className={cx(styles.roleSelect)} aria-label="Role for new people" options={roles.map((entry) => ({ value: entry, label: entry }))} value={role} onValueChange={setRole} animated={animated} />
            <Button type="submit" shape="pill" animated={animated} disabled={!canSend && sent === 0} status={sent > 0 ? 'success' : 'idle'} successLabel={sent > 1 ? `${sent} invites sent` : 'Invite sent'} onSuccessEnd={() => setSent(0)}>{emails.length > 1 ? `Send ${emails.length} invites` : 'Send invite'}</Button>
          </div>
          <p className={styles.hint}>Separate addresses with commas. Invites expire in 7 days.</p>
        </form>

        <div className={kit.section}>
          <div className={styles.listHead}>
            <h3 className={styles.sectionTitle}>Members <span className={styles.count}>{members.length}</span></h3>
            <span className={styles.search}><SearchField value={query} onValueChange={setQuery} placeholder="Search by name or email" aria-label="Search members" animated={animated} /></span>
          </div>
          <ul className={styles.list}>
            {shown.map((member, index) => (
              <motion.li key={member.id} {...rowEnter(still, index)} className={styles.member}>
                <Avatar name={member.name} src={member.src} person={member.person} size={36} presence={Boolean(member.online)} animated={animated} />
                <div className={styles.who}>
                  <span className={styles.name}>{member.name}{member.you ? <span className={styles.you}>You</span> : null}</span>
                  <span className={styles.email2}>{member.email}</span>
                  <span className={styles.mobileMeta}>{member.role} · {member.activity}</span>
                </div>
                <span className={styles.activity}>{member.activity}</span>
                <div className={styles.memberRole}>
                  {member.role === 'Owner' ? <span className={styles.owner}>Owner</span> : <Select kind="pill" aria-label={`Role for ${member.name}`} options={roles.map((entry) => ({ value: entry, label: entry }))} value={member.role} animated={animated} onValueChange={(next) => onRoleChange?.(member.id, next)} />}
                </div>
                <span className={styles.remove}>
                  {member.role === 'Owner' ? null : <IconButton variant="ghost" size="sm" animated={animated} label={`Remove ${member.name}`} icon={<UserMinusIcon size={16} />} onClick={() => onRemove?.(member.id)} />}
                </span>
              </motion.li>
            ))}
            {shown.length === 0 ? <li className={styles.none}>No one matches {query}</li> : null}
          </ul>
        </div>

        {pending.length ? (
          <div className={kit.section}>
            <h3 className={styles.sectionTitle}>Pending invites <span className={styles.count}>{pending.length}</span></h3>
            <ul className={styles.list}>
              {pending.map((invite, index) => (
                <motion.li key={invite.id} {...rowEnter(still, index)} className={styles.member}>
                  <Avatar name={invite.email.split('@')[0] ?? invite.email} size={36} animated={animated} />
                  <div className={styles.who}>
                    <span className={styles.name} data-wrap="">{invite.email}</span>
                    <span className={styles.email2} data-keep="">{invite.role} · Invited {invite.invited}</span>
                  </div>
                  <Button variant="ghost" size="sm" animated={animated} aria-label={`Resend to ${invite.email}`} feedback={{ loading: 'Sending', success: 'Sent' }} onClick={() => onResend?.(invite.id)}>Resend</Button>
                  <span className={styles.revoke}><Button variant="ghost" size="sm" animated={animated} aria-label={`Revoke ${invite.email}`} onClick={() => onRevoke?.(invite.id)}>Revoke</Button></span>
                </motion.li>
              ))}
            </ul>
          </div>
        ) : null}

        <footer className={cx(kit.section, styles.footer)}>Changes apply right away</footer>
      </div>
    </motion.section>
  )
}
