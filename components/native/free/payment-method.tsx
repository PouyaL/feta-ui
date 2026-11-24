import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { DropdownMenu } from './dropdown-menu'
import { IconButton } from './icon-button'
import { Radio } from './radio'

export type PaymentMethodProps = {
  /** `selected` rings the row and swaps the menu for a Radio. `add` is a dashed row. Default `default`. */
  state?: 'default' | 'selected' | 'expired' | 'add'
  brand?: string
  label?: string
  expiry?: string
  /** Shows the Default badge. */
  isDefault?: boolean
  /** Marks the row as part of a choice, so it shows a Radio. */
  name?: string
  renderIcon: RenderIcon
  onSelect?: () => void
  onAdd?: () => void
  onMakeDefault?: () => void
  onRemove?: () => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A saved card: 40 by 28 brand tile, label and expiry, status and a menu. */
export function PaymentMethod({ state = 'default', brand = 'CARD', label = 'Card ending 4242', expiry = '08/28', isDefault = false, name, renderIcon, onSelect, onAdd, onMakeDefault, onRemove, animated = true, style }: PaymentMethodProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const enter = still ? {} : { entering: rowEnter() }
  if (state === 'add') {
    return (
      <Animated.View {...enter}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add payment method" onPress={onAdd} style={({ pressed }) => [styles.row, styles.add, pressed && styles.pressed, style]}>
          <View style={styles.addTile}>{renderIcon('plus', 16)}</View>
          <Text style={styles.label}>Add payment method</Text>
          {renderIcon('chevron-right', 16)}
        </Pressable>
      </Animated.View>
    )
  }
  const expired = state === 'expired'
  const body = (
    <>
      <View style={styles.tile}><Text style={styles.brand} numberOfLines={1}>{brand}</Text></View>
      <View style={styles.text}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        <Text style={[styles.expiry, expired && styles.expired]}>{expired ? `Expired ${expiry}` : `Expires ${expiry}`}</Text>
      </View>
      {expired ? <Badge size="sm" tone="danger" mark>Expired</Badge> : isDefault || (state === 'default' && !name) ? <Badge size="sm" mark={false}>Default</Badge> : null}
    </>
  )
  if (state === 'selected' || name) {
    const selected = state === 'selected'
    return (
      <Animated.View {...enter}>
        <Pressable accessibilityRole="radio" accessibilityLabel={label} aria-checked={selected} aria-disabled={!onSelect} disabled={!onSelect} onPress={onSelect} style={[styles.row, selected && styles.selected, style]}>
          {body}
          <Radio checked={selected} {...(onSelect ? { onChange: onSelect } : {})} accessibilityLabel={label} animated={animated} />
        </Pressable>
      </Animated.View>
    )
  }
  return (
    <Animated.View {...enter} style={[styles.row, style]}>
      {body}
      <DropdownMenu
        label={`${label} actions`}
        align="end"
        animated={animated}
        entries={[{ label: 'Make default', disabled: expired, ...(onMakeDefault ? { onSelect: onMakeDefault } : {}) }, { label: 'Remove', destructive: true, ...(onRemove ? { onSelect: onRemove } : {}) }]}
        trigger={(props) => <IconButton {...props} variant="ghost" size="sm" label={`${label} actions`} icon={renderIcon('more-horizontal', 16)} animated={animated} />}
      />
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  row: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: space[3], minHeight: 56, padding: space[3] },
  add: { borderStyle: 'dashed', borderWidth: 1 },
  pressed: { backgroundColor: c.ink4 },
  selected: { borderColor: c.textPrimary, borderWidth: 2 },
  tile: { alignItems: 'center', backgroundColor: c.muted, borderRadius: radius.md, height: 28, justifyContent: 'center', width: 40 },
  addTile: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.md, height: 28, justifyContent: 'center', width: 40 },
  brand: type(10, c.textPrimary, '600', true),
  text: { flex: 1, gap: space[0.5] },
  label: { ...type(14, c.textPrimary, '500'), flexShrink: 1 },
  expiry: type(12, c.textSecondary),
  expired: { color: c.danger },
})
