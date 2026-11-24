import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { space, type Colors } from '../kit'
import { Avatar } from './avatar'
import { Badge } from './badge'
import { Button } from './button'
import { rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { DropdownMenu, type MenuEntry } from './dropdown-menu'
import { IconButton } from './icon-button'
import { Select, type SelectOption } from './select'

export const initials = (name: string): string => name.split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')

const toOptions = (roles: (SelectOption | string)[]): SelectOption[] => roles.map((role) => (typeof role === 'string' ? { value: role, label: role } : role))

export type MemberRowProps = {
  /** Omitted for a pending invite, which shows the address instead. */
  name?: string
  email: string
  src?: string
  /** `pending` shows Resend, `deactivated` mutes the name and locks the role. */
  status?: 'active' | 'pending' | 'deactivated'
  /** Last activity, or when the invite expires. */
  activity?: string
  /** The line under a pending invite. */
  note?: string
  role: string
  roles: (SelectOption | string)[]
  renderIcon: RenderIcon
  onRoleChange?: (role: string) => void
  onResend?: () => void
  /** Rows of the menu behind the more button. */
  menu?: MenuEntry[]
  /** Position in a list, for the 40 ms stagger. */
  index?: number
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** One workspace member: avatar, name and email, a role Select and a menu. Activity sits under the email. */
export function MemberRow({ name, email, src, status = 'active', activity, note, role, roles, renderIcon, onRoleChange, onResend, menu = [], index = 0, animated = true, style }: MemberRowProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const label = name ?? email
  const pending = status === 'pending'
  const off = status === 'deactivated'
  return (
    <Animated.View {...(still ? {} : { entering: rowEnter(index) })} style={[styles.row, style]}>
      <Avatar initials={initials(label)} {...(src ? { src } : {})} size="md" animated={animated} />
      <View style={styles.who}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, off && styles.muted]} numberOfLines={1}>{label}</Text>
          {pending ? <Badge size="sm" tone="info" mark>Invited</Badge> : null}
          {off ? <Badge size="sm" mark>Deactivated</Badge> : null}
        </View>
        <Text style={styles.email} numberOfLines={1}>{pending ? note : email}</Text>
        {activity ? <Text style={styles.email} numberOfLines={1}>{activity}</Text> : null}
      </View>
      {off
        ? <Text style={styles.email}>{role}</Text>
        : <Select kind="pill" accessibilityLabel={`Role for ${label}`} options={toOptions(roles)} value={role} animated={animated} {...(onRoleChange ? { onValueChange: onRoleChange } : {})} />}
      {pending ? <Button variant="ghost" size="sm" animated={animated} accessibilityLabel={`Resend to ${label}`} onPress={onResend}>Resend</Button> : null}
      <DropdownMenu label={`More for ${label}`} entries={menu} align="end" animated={animated} trigger={(props) => <IconButton {...props} variant="ghost" size="sm" animated={animated} label={`More for ${label}`} icon={renderIcon('more-horizontal', 16)} />} />
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 56, paddingVertical: space[2] },
  who: { flex: 1, gap: space[0.5] },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  name: { ...type(14, c.textPrimary, '500'), flexShrink: 1 },
  muted: { color: c.textTertiary },
  email: type(12, c.textSecondary),
})
