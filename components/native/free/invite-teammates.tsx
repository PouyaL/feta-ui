import { useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Avatar, AvatarGroup } from './avatar'
import { Button } from './button'
import { Panel, PanelBody, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Input } from './input'
import { splitEmails } from './invite-field'
import { initials } from './member-row'

export type PendingTeammate = { id: string; name: string; email: string; role: string; sent: string }

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
  renderIcon: RenderIcon
  onSend?: (entries: string[]) => void
  onUpgrade?: () => void
  onResend?: (id: string) => void
  onRevoke?: (id: string) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Part = 'members' | 'pending' | 'new' | 'over' | 'free'

/** An invite panel: names or emails, a seat bar split by members, pending and new, and the pending list. */
export function InviteTeammates({ workspace, plan, seats, members, pending = [], people, sample, defaultValue = '', upgradeLabel = 'Upgrade to Team', renderIcon, onSend, onUpgrade, onResend, onRevoke, animated = true, style }: InviteTeammatesProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [text, setText] = useState(defaultValue)
  // The success label outlives the field, which clears while it shows.
  const [sentCount, setSentCount] = useState(0)
  const entries = useMemo(() => splitEmails(text), [text])
  const held = members + pending.length
  const used = held + entries.length
  const over = used > seats
  const left = Math.max(0, seats - held)
  const parts: { name: Part; size: number }[] = [{ name: 'members', size: members }, { name: 'pending', size: pending.length }, { name: over ? 'over' : 'new', size: entries.length }, { name: 'free', size: Math.max(seats, used) - used }]
  const key = (part: Part, children: ReactNode): ReactNode => <View style={styles.key}><View style={[styles.keyDot, styles[part]]} /><Text style={styles.small}>{children}</Text></View>

  return (
    <Panel title="Invite teammates" subtitle={`Add people to ${workspace} by name or email`} label="Invite teammates" animated={animated} actions={people ? <AvatarGroup items={people.map((name) => ({ key: name, initials: initials(name) }))} max={people.length} size="sm" label={people.join(', ')} animated={animated} /> : undefined} style={style}>
      <PanelBody>
        <Input value={text} invalid={over} placeholder="Name or email" accessibilityLabel="Names or emails" autoCapitalize="none" animated={animated} onChangeText={setText} />
        {over ? <Text accessibilityRole="alert" style={styles.error}>Only {left} seats left on {plan.replace(/ plan$/, '')}. Remove one or upgrade.</Text> : <Text style={styles.small}>Separate with commas, or paste a whole list</Text>}
        {sample && !over ? <Button variant="link" size="sm" animated={animated} leadingIcon={renderIcon('copy', 12)} onPress={() => setText(sample)}>Paste a sample list</Button> : null}
        <View accessibilityLabel={`${used} of ${seats} seats on ${plan}`} accessible style={styles.usage}>
          <View style={styles.usageHead}><Text style={[styles.total, over && styles.overText]}>{used} of {seats} seats</Text><Text style={styles.tertiary}>{plan}</Text></View>
          <View style={styles.bar}>{parts.map((part) => (part.size > 0 ? <View key={part.name} style={[styles.segment, styles[part.name], { flexGrow: part.size }]} /> : null))}</View>
          <View style={styles.keys}>{key('members', `${members} members`)}{key('pending', `${pending.length} pending`)}{key(over ? 'over' : 'new', `${entries.length} new`)}</View>
        </View>
        <View style={styles.actions}>
          <IconButton variant="ghost" size="sm" animated={animated} label="Clear" disabled={!text} icon={renderIcon('rotate-ccw', 16)} onPress={() => setText('')} />
          {over
            ? <Button variant="secondary" shape="pill" animated={animated} onPress={onUpgrade}>{upgradeLabel}</Button>
            : <Button shape="pill" animated={animated} leadingIcon={renderIcon('send', 16)} disabled={entries.length === 0} feedback={{ loading: 'Sending', success: `${sentCount} sent`, loadingMs: 900 }} onPress={() => { setSentCount(entries.length); onSend?.(entries); setTimeout(() => setText(''), 900) }}>Send invites</Button>}
        </View>
      </PanelBody>
      {pending.length ? (
        <PanelBody title={`Pending ${pending.length}`}>
          {pending.map((person, index) => (
            <Animated.View key={person.id} {...(still ? {} : { entering: rowEnter(index) })} style={styles.person}>
              <Avatar initials={initials(person.name)} size="md" animated={animated} />
              <View style={styles.who}>
                <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
                <Text style={styles.small} numberOfLines={1}>{person.role} · {person.email}</Text>
                <Text style={styles.tertiary}>Sent {person.sent}</Text>
              </View>
              <Button variant="ghost" size="sm" animated={animated} accessibilityLabel={`Resend to ${person.name}`} feedback={{ loading: 'Sending', success: 'Sent', loadingMs: 900 }} onPress={() => onResend?.(person.id)}>Resend</Button>
              <IconButton variant="ghost" size="sm" animated={animated} label={`Revoke ${person.name}`} icon={renderIcon('x', 16)} onPress={() => onRevoke?.(person.id)} />
            </Animated.View>
          ))}
        </PanelBody>
      ) : null}
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  small: type(12, c.textSecondary),
  tertiary: type(12, c.textTertiary),
  error: type(12, c.danger),
  usage: { gap: space[2] },
  usageHead: { flexDirection: 'row', justifyContent: 'space-between' },
  total: type(14, c.textPrimary, '500'),
  overText: { color: c.danger },
  bar: { borderRadius: radius.full, flexDirection: 'row', gap: 2, height: 8, overflow: 'hidden' },
  segment: { flexBasis: 0, height: 8 },
  members: { backgroundColor: c.inverse },
  pending: { backgroundColor: c.textTertiary },
  new: { backgroundColor: c.success },
  over: { backgroundColor: c.danger },
  free: { backgroundColor: c.ink5 },
  keys: { flexDirection: 'row', gap: space[3] },
  key: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  keyDot: { borderRadius: radius.full, height: 8, width: 8 },
  actions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  person: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 56 },
  who: { flex: 1, gap: space[0.5] },
  name: type(14, c.textPrimary, '500'),
})
