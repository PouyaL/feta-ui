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
      <Text style={styles.price}><Text style={styles.amount}>{price}</Text> <Text style={styles.period}>{period}</Text></Text>
      <Text style={styles.pitch}>{pitch}</Text>
      <View style={styles.features}>
        {features.map((feature) => <View key={feature} style={styles.feature}>{renderIcon('check', 16)}<Text style={styles.featureText}>{feature}</Text></View>)}
      </View>
      <Button style={styles.action} shape="pill" variant={state === 'recommended' || state === 'selected' ? 'primary' : 'secondary'} disabled={state === 'current'} onPress={onAction} animated={animated}>{action}</Button>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  // The web rings the card with a 4 px ink shadow (2 px Primary when selected); a border of the same width draws it.
  card: { alignSelf: 'stretch', backgroundColor: c.surface, borderColor: c.ink4, borderRadius: radius.panel + 4, borderWidth: 4, gap: space[3], maxWidth: 358, paddingBottom: space[5], paddingHorizontal: space[5], paddingTop: space[4] },
  selected: { borderColor: c.textPrimary, borderWidth: 2, paddingBottom: space[5] + 2, paddingHorizontal: space[5] + 2, paddingTop: space[4] + 2 },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', minHeight: 24 },
  name: { ...type(16, c.textPrimary, '500'), lineHeight: 20 },
  price: { lineHeight: 32 },
  amount: { ...type(28, c.textPrimary, '600'), fontVariant: ['tabular-nums'] },
  period: type(12, c.textSecondary),
  pitch: { ...type(14, c.textSecondary), lineHeight: 20 },
  features: { borderTopColor: c.ink5, borderTopWidth: 1, gap: space[2], paddingTop: space[3] },
  feature: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  featureText: { ...type(14, c.textPrimary), flex: 1, lineHeight: 18 },
  action: { alignSelf: 'stretch', marginTop: space[1] },
})
