import { useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Avatar, type AvatarPerson } from './avatar'
import { Badge } from './badge'
import { Button, SELF } from './button'
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
  /** One of the illustrated people, drawn when there is no photo. */
  person?: AvatarPerson
  /** `pending` shows Resend, `deactivated` mutes the name and locks the role. */
  status?: 'active' | 'pending' | 'deactivated'
  /** Last activity. Hidden on a row narrower than 480, as on the web. */
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

/** Below this row width the web's container query drops activity, the role Select and Resend, and shows the role as text. */
const NARROW = 480

/** One workspace member: avatar, name and email, last activity, a role Select and a menu. */
export function MemberRow({ name, email, src, person, status = 'active', activity, note, role, roles, renderIcon, onRoleChange, onResend, menu = [], index = 0, animated = true, style }: MemberRowProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [narrow, setNarrow] = useState(false)
  const label = name ?? email
  const pending = status === 'pending'
  const off = status === 'deactivated'
  // A narrow row hides Resend, so the menu carries it instead.
  const entries: MenuEntry[] = narrow && pending && onResend ? [{ label: 'Resend invite', onSelect: onResend }, ...menu] : menu
  function measure(e: LayoutChangeEvent): void {
    const next = e.nativeEvent.layout.width < NARROW
    if (next !== narrow) setNarrow(next)
  }
  return (
    <Animated.View {...(still ? {} : { entering: rowEnter(index) })} onLayout={measure} style={[styles.row, style]}>
      <Avatar initials={initials(label)} {...(src ? { src } : {})} {...(person ? { person } : {})} size="md" animated={animated} />
      <View style={styles.who}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, off && styles.muted]} numberOfLines={1}>{label}</Text>
          {pending ? <Badge size="sm" tone="info" mark>Invited</Badge> : null}
          {off ? <Badge size="sm" mark>Deactivated</Badge> : null}
        </View>
        <Text style={styles.email} numberOfLines={1}>{pending ? note : email}</Text>
      </View>
      {activity && !narrow ? <Text style={styles.activity} numberOfLines={1}>{activity}</Text> : null}
      <View style={[styles.role, narrow && styles.roleNarrow]}>
        {off
          ? <Text style={[styles.roleText, styles.muted]}>{role}</Text>
          : narrow
            ? <Text style={styles.roleText}>{role}</Text>
            : <Select kind="pill" accessibilityLabel={`Role for ${label}`} options={toOptions(roles)} value={role} animated={animated} {...(onRoleChange ? { onValueChange: onRoleChange } : {})} />}
      </View>
      {pending && !narrow ? <Button style={SELF.center} variant="ghost" size="sm" animated={animated} accessibilityLabel={`Resend to ${label}`} onPress={onResend}>Resend</Button> : null}
      <DropdownMenu label={`More for ${label}`} entries={entries} align="end" animated={animated} trigger={(props) => <IconButton {...props} variant="ghost" size="sm" animated={animated} label={`More for ${label}`} icon={renderIcon('more-horizontal', 16)} />} />
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  row: { alignItems: 'center', borderRadius: radius.control, flexDirection: 'row', gap: space[3], maxWidth: 640, minHeight: 60, paddingHorizontal: space[3], paddingVertical: space[2], width: '100%' },
  who: { flex: 1, minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], minWidth: 0 },
  name: { ...type(14, c.textPrimary, '500'), flexShrink: 1, lineHeight: 20 },
  muted: { color: c.textTertiary },
  email: { ...type(12, c.textSecondary), lineHeight: 16 },
  activity: { ...type(12, c.textTertiary), lineHeight: 16 },
  role: { minWidth: 96 },
  roleNarrow: { minWidth: 0 },
  roleText: { ...type(12, c.textSecondary), lineHeight: 16 },
})
