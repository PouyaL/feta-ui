import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { Button } from './button'
import { panelEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Radio } from './radio'

export type PlanCardProps = {
  name: string
  price: string
  period: string
  pitch: string
  features: string[]
  /** `current` disables the Button, `recommended` uses Primary, `selected` rings the card. Default `default`. */
  state?: 'default' | 'current' | 'recommended' | 'selected'
  /** Button text. */
  action: ReactNode
  renderIcon: RenderIcon
  onAction?: () => void
  /** The Radio in the corner, for choosing between cards. */
  onSelect?: () => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** One plan: name, price, pitch, features with checks and a full width Button. */
export function PlanCard({ name, price, period, pitch, features, state = 'default', action, renderIcon, onAction, onSelect, animated = true, style }: PlanCardProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={`${name} plan`} style={[styles.card, state === 'selected' && styles.selected, style]}>
      <View style={styles.head}>
        <Text style={styles.name} accessibilityRole="header">{name}</Text>
        {state === 'current' ? <Badge size="sm" mark={false}>Current</Badge> : null}
        {state === 'recommended' ? <Badge size="sm" tone="accent" mark>Recommended</Badge> : null}
        {state === 'default' || state === 'selected' ? <Radio accessibilityLabel={`Select ${name}`} checked={state === 'selected'} onChange={() => onSelect?.()} animated={animated} /> : null}
      </View>
      <View style={styles.price}><Text style={styles.amount}>{price}</Text><Text style={styles.small}>{period}</Text></View>
      <Text style={styles.small}>{pitch}</Text>
      <View style={styles.features}>
        {features.map((feature) => <View key={feature} style={styles.feature}>{renderIcon('check', 16)}<Text style={styles.featureText}>{feature}</Text></View>)}
      </View>
      <Button shape="pill" variant={state === 'recommended' || state === 'selected' ? 'primary' : 'secondary'} disabled={state === 'current'} onPress={onAction} animated={animated}>{action}</Button>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[3], padding: space[4] },
  selected: { borderColor: c.textPrimary, borderWidth: 2 },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  name: type(16, c.textPrimary, '500'),
  price: { alignItems: 'baseline', flexDirection: 'row', gap: space[1] },
  amount: type(28, c.textPrimary, '500'),
  small: type(14, c.textSecondary),
  features: { gap: space[2] },
  feature: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  featureText: { ...type(14, c.textPrimary), flex: 1 },
})
