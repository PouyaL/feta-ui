import { useMemo, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { space, type Colors } from '../kit'
import { Avatar } from './avatar'
import { Button, SELF } from './button'
import { Panel, PanelBody, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Input } from './input'
import { splitEmails } from './invite-field'
import { initials } from './member-row'
import { SearchField } from './search'
import { Select } from './select'
import { Meter } from './usage-meter'

/** The web's mobile layout drops the search; a long list keeps it so people stay findable. */
const SEARCH_FROM = 8

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
  /** Kept for the wide layout; the phone layout, as the web's mobile view, has no per-row role picker. */
  onRoleChange?: (memberId: string, role: string) => void
  onRemove?: (memberId: string) => void
  onResend?: (inviteId: string) => void
  /** Kept for the wide layout; the phone layout shows Resend only, as the web's mobile view. */
  onRevoke?: (inviteId: string) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Workspace members: seat usage, an invite row, the member list and pending invites. */
export function Members({ workspace, seats, members, pending = [], roles = ['Admin', 'Member', 'Viewer'], defaultRole = 'Member', defaultDraft = '', renderIcon, onInvite, onRemove, onResend, animated = true, style }: MembersProps) {
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
      <PanelBody style={styles.firstBody}>
        <Text style={styles.small}><Text style={styles.seatUsed}>{used}</Text> of {seats} seats</Text>
        <Meter value={Math.min(used, seats) / seats} label={`${used} of ${seats} seats`} animated={animated} />
      </PanelBody>
      <PanelBody title="Invite people">
        <Input value={draft} placeholder="name@example.com" accessibilityLabel="Email addresses" autoCapitalize="none" keyboardType="email-address" animated={animated} onChangeText={setDraft} />
        <View style={styles.inviteRow}>
          <Select accessibilityLabel="Role for new people" options={options} value={role} onValueChange={setRole} animated={animated} style={styles.roleSelect} />
          <Button style={SELF.center} shape="pill" animated={animated} disabled={emails.length === 0 && sent === 0} status={sent > 0 ? 'success' : 'idle'} successLabel={sent > 1 ? `${sent} invites sent` : 'Invite sent'} onSuccessEnd={() => setSent(0)} onPress={() => { onInvite?.(emails, role); setDraft(''); setSent(emails.length) }}>{emails.length > 1 ? `Send ${emails.length} invites` : 'Send invite'}</Button>
        </View>
        <Text style={styles.small}>Separate addresses with commas. Invites expire in 7 days.</Text>
      </PanelBody>
      <PanelBody>
        <Heading title="Members" count={members.length} styles={styles} />
        {members.length > SEARCH_FROM ? <SearchField value={query} onValueChange={setQuery} placeholder="Search by name or email" accessibilityLabel="Search members" animated={animated} /> : null}
        {shown.map((member, index) => (
          <Animated.View key={member.id} {...(still ? {} : { entering: rowEnter(index) })} style={styles.member}>
            <Avatar initials={initials(member.name)} {...(member.src ? { src: member.src } : {})} {...(member.online ? { badge: 'online' as const } : {})} size="md" animated={animated} />
            <View style={styles.who}>
              <Text style={styles.name} numberOfLines={1}>{member.name}{member.you ? <Text style={styles.you}>  You</Text> : null}</Text>
              <Text style={styles.small} numberOfLines={1}>{member.role} · {member.activity}</Text>
            </View>
            {member.role === 'Owner' ? null : <IconButton style={SELF.center} variant="ghost" size="sm" animated={animated} label={`Remove ${member.name}`} icon={renderIcon('user-minus', 16)} onPress={() => onRemove?.(member.id)} />}
          </Animated.View>
        ))}
        {shown.length === 0 ? <Text style={styles.small}>No one matches {query}</Text> : null}
      </PanelBody>
      {pending.length ? (
        <PanelBody>
          <Heading title="Pending invites" count={pending.length} styles={styles} />
          {pending.map((invite, index) => (
            <Animated.View key={invite.id} {...(still ? {} : { entering: rowEnter(index) })} style={styles.member}>
              <Avatar initials={initials(invite.email.split('@')[0] ?? invite.email)} size="md" animated={animated} />
              <View style={styles.who}>
                <Text style={styles.name} numberOfLines={1}>{invite.email}</Text>
                <Text style={styles.small} numberOfLines={1}>{invite.role} · Invited {invite.invited}</Text>
              </View>
              <Button style={SELF.center} variant="ghost" size="sm" animated={animated} accessibilityLabel={`Resend to ${invite.email}`} feedback={{ loading: 'Sending', success: 'Sent' }} onPress={() => onResend?.(invite.id)}>Resend</Button>
            </Animated.View>
          ))}
        </PanelBody>
      ) : null}
    </Panel>
  )
}

/** The section title with its small mono count, as the web's `Members 5`. */
function Heading({ title, count, styles }: { title: string; count: number; styles: ReturnType<typeof createStyles> }) {
  return <View accessible accessibilityRole="header" accessibilityLabel={`${title} ${count}`} style={styles.heading}><Text style={styles.headingTitle}>{title}</Text><Text style={styles.count}>{count}</Text></View>
}

const createStyles = (c: Colors) => StyleSheet.create({
  // The web runs the first section straight on from the header: no hairline, no second inset.
  firstBody: { borderTopWidth: 0, paddingTop: 0 },
  small: type(12, c.textSecondary),
  seatUsed: type(14, c.textPrimary, '500'),
  heading: { alignItems: 'baseline', flexDirection: 'row', gap: space[2] },
  headingTitle: type(14, c.textPrimary, '500'),
  count: type(10, c.textTertiary, '400', true),
  you: type(12, c.textTertiary),
  inviteRow: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  // The field Select is 100% wide on its own; in this row it shares the width with the button, as on the web's mobile layout.
  roleSelect: { flex: 1, minWidth: 0, width: 'auto' },
  member: { alignItems: 'center', flexDirection: 'row', gap: space[3], minHeight: 44 },
  who: { flex: 1, gap: space[0.5] },
  name: type(14, c.textPrimary, '500'),
})
