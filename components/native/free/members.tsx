import { useMemo, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { space, type Colors } from '../kit'
import { Avatar } from './avatar'
import { Button } from './button'
import { Panel, PanelBody, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Input } from './input'
import { splitEmails } from './invite-field'
import { initials } from './member-row'
import { SearchField } from './search'
import { Select } from './select'
import { Meter } from './usage-meter'

export type Member = { id: string; name: string; email: string; role: string; activity: string; you?: boolean; online?: boolean; src?: string }
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
  renderIcon: RenderIcon
  onInvite?: (emails: string[], role: string) => void
  onRoleChange?: (memberId: string, role: string) => void
  onRemove?: (memberId: string) => void
  onResend?: (inviteId: string) => void
  onRevoke?: (inviteId: string) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Workspace members: seat usage, an invite row, the member list and pending invites. */
export function Members({ workspace, seats, members, pending = [], roles = ['Admin', 'Member', 'Viewer'], defaultRole = 'Member', defaultDraft = '', renderIcon, onInvite, onRoleChange, onRemove, onResend, onRevoke, animated = true, style }: MembersProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [draft, setDraft] = useState(defaultDraft)
  const [role, setRole] = useState(defaultRole)
  const [query, setQuery] = useState('')
  // How many invites the last send carried, 0 once its success has shown.
  const [sent, setSent] = useState(0)
  const emails = useMemo(() => splitEmails(draft), [draft])
  const used = members.length + pending.length + emails.length
  const options = roles.map((entry) => ({ value: entry, label: entry }))
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(q)) : members
  }, [members, query])

  return (
    <Panel title="Members" subtitle={`Manage who can work in the ${workspace} workspace.`} label="Members" animated={animated} footer={<Text style={styles.small}>Changes apply right away</Text>} style={style}>
      <PanelBody>
        <Text style={styles.small}>{used} of {seats} seats</Text>
        <Meter value={Math.min(used, seats) / seats} label={`${used} of ${seats} seats`} animated={animated} />
      </PanelBody>
      <PanelBody title="Invite people">
        <Input value={draft} placeholder="name@example.com" accessibilityLabel="Email addresses" autoCapitalize="none" keyboardType="email-address" animated={animated} onChangeText={setDraft} />
        <View style={styles.inviteRow}>
          <Select accessibilityLabel="Role for new people" options={options} value={role} onValueChange={setRole} animated={animated} style={styles.roleSelect} />
          <Button shape="pill" animated={animated} disabled={emails.length === 0 && sent === 0} status={sent > 0 ? 'success' : 'idle'} successLabel={sent > 1 ? `${sent} invites sent` : 'Invite sent'} onSuccessEnd={() => setSent(0)} onPress={() => { onInvite?.(emails, role); setDraft(''); setSent(emails.length) }}>{emails.length > 1 ? `Send ${emails.length} invites` : 'Send invite'}</Button>
        </View>
        <Text style={styles.small}>Separate addresses with commas. Invites expire in 7 days.</Text>
      </PanelBody>
      <PanelBody title={`Members ${members.length}`}>
        <SearchField value={query} onValueChange={setQuery} placeholder="Search by name or email" accessibilityLabel="Search members" animated={animated} />
        {shown.map((member, index) => (
          <Animated.View key={member.id} {...(still ? {} : { entering: rowEnter(index) })} style={styles.member}>
            <Avatar initials={initials(member.name)} {...(member.src ? { src: member.src } : {})} {...(member.online ? { badge: 'online' as const } : {})} size="md" animated={animated} />
            <View style={styles.who}>
              <Text style={styles.name} numberOfLines={1}>{member.name}{member.you ? ' · You' : ''}</Text>
              <Text style={styles.small} numberOfLines={1}>{member.email}</Text>
              <Text style={styles.small} numberOfLines={1}>{member.activity}</Text>
            </View>
            {member.role === 'Owner' ? <Text style={styles.small}>Owner</Text> : (
              <>
                <Select kind="pill" accessibilityLabel={`Role for ${member.name}`} options={options} value={member.role} animated={animated} onValueChange={(next) => onRoleChange?.(member.id, next)} />
                <IconButton variant="ghost" size="sm" animated={animated} label={`Remove ${member.name}`} icon={renderIcon('user-minus', 16)} onPress={() => onRemove?.(member.id)} />
              </>
            )}
          </Animated.View>
        ))}
        {shown.length === 0 ? <Text style={styles.small}>No one matches {query}</Text> : null}
      </PanelBody>
      {pending.length ? (
        <PanelBody title={`Pending invites ${pending.length}`}>
          {pending.map((invite, index) => (
            <Animated.View key={invite.id} {...(still ? {} : { entering: rowEnter(index) })} style={styles.member}>
              <Avatar initials={initials(invite.email.split('@')[0] ?? invite.email)} size="md" animated={animated} />
              <View style={styles.who}>
                <Text style={styles.name} numberOfLines={1}>{invite.email}</Text>
                <Text style={styles.small} numberOfLines={1}>{invite.role} · Invited {invite.invited}</Text>
              </View>
              <Button variant="ghost" size="sm" animated={animated} accessibilityLabel={`Resend to ${invite.email}`} feedback={{ loading: 'Sending', success: 'Sent' }} onPress={() => onResend?.(invite.id)}>Resend</Button>
              <Button variant="ghost" size="sm" animated={animated} accessibilityLabel={`Revoke ${invite.email}`} onPress={() => onRevoke?.(invite.id)}>Revoke</Button>
            </Animated.View>
          ))}
        </PanelBody>
      ) : null}
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  small: type(12, c.textSecondary),
  inviteRow: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  // The field Select is 100% wide on its own; in this row it shares the width with the button, as on the web's mobile layout.
  roleSelect: { flex: 1, minWidth: 0, width: 'auto' },
  member: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 56 },
  who: { flex: 1, gap: space[0.5] },
  name: type(14, c.textPrimary, '500'),
})
