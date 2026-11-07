'use client'
import { motion } from 'motion/react'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import type { AvatarPerson } from '../avatar/avatar'
import { Button } from '../button/button'
import { DropdownMenu, type MenuEntry } from '../dropdown-menu/dropdown-menu'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Select, type SelectOption } from '../select/select'
import { Avatar, Tag, rowEnter } from '../product-kit/product-kit'
import styles from './member-row.module.css'

export type MemberRowProps = {
  /** Omitted for a pending invite, which shows the address instead. */
  name?: string
  email: string
  src?: string
  person?: AvatarPerson
  /** `pending` shows Resend, `deactivated` mutes the name and locks the role. */
  status?: 'active' | 'pending' | 'deactivated'
  /** Last activity, or when the invite expires. Dropped on Mobile. */
  activity?: string
  /** The line under a pending invite. */
  note?: string
  role: string
  roles: (SelectOption | string)[]
  onRoleChange?: (role: string) => void
  onResend?: () => void
  /** Rows of the menu behind the more button. */
  menu?: MenuEntry[]
  /** Forces the hover pose for previews. */
  hovered?: boolean
  /** Position in a list, for the 40 ms stagger. */
  index?: number
  animated?: boolean
  className?: string
}

const toOptions = (roles: (SelectOption | string)[]): SelectOption[] => roles.map((role) => (typeof role === 'string' ? { value: role, label: role } : role))

/** One workspace member: avatar, name and email, last activity, a role Select and a menu. */
export function MemberRow({ name, email, src, person, status = 'active', activity, note, role, roles, onRoleChange, onResend, menu = [], hovered, index = 0, animated = true, className }: MemberRowProps) {
  const still = useStill(animated)
  const label = name ?? email
  const pending = status === 'pending'
  const off = status === 'deactivated'
  return (
    <motion.div {...rowEnter(still, index)} className={cx(styles.row, className)} data-status={status} data-hovered={hovered ? '' : undefined}>
      <Avatar name={label} src={src} person={person} size={36} animated={animated} />
      <div className={styles.who}>
        <span className={styles.nameRow}>
          <span className={styles.name}>{label}</span>
          {pending ? <Tag tone="info" dot animated={animated}>Invited</Tag> : null}
          {off ? <Tag dot animated={animated}>Deactivated</Tag> : null}
        </span>
        <span className={styles.email}>{pending ? note : email}</span>
      </div>
      {activity ? <span className={styles.activity}>{activity}</span> : null}
      <div className={styles.role}>
        {off
          ? <span className={styles.plainRole}>{role}</span>
          : <span className={styles.select}><Select kind="pill" aria-label={`Role for ${label}`} options={toOptions(roles)} value={role} animated={animated} {...(onRoleChange ? { onValueChange: onRoleChange } : {})} /></span>}
        {off ? null : <span className={styles.mobileRole}>{role}</span>}
      </div>
      {pending ? <span className={styles.resend}><Button variant="ghost" size="sm" animated={animated} aria-label={`Resend to ${label}`} onClick={onResend}>Resend</Button></span> : null}
      <DropdownMenu label={`More for ${label}`} entries={menu} align="end" animated={animated} trigger={({ ref, ...props }) => <IconButton {...props} ref={ref} variant="ghost" size="sm" animated={animated} label={`More for ${label}`} icon={<MoreHorizontalIcon size={16} />} />} />
    </motion.div>
  )
}
