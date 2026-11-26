import { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { StarIcon as FilledStarIcon } from '@fetaui/react-native/filled/star'
import { StarIcon as RoundedStarIcon } from '@fetaui/react-native/rounded/star'
import { space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const STARS = [1, 2, 3, 4, 5] as const
const TAP_SCALE = 0.9
const PRESS_SPRING = { stiffness: 600, damping: 32 } as const
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)
/** Stars sit 4 apart like the web; the slop grows each one to a 44 point target. */
const STAR_SLOP = { top: 10, bottom: 10, left: 2, right: 2 } as const

/** Like the web: an on star is the fetaUI star filled in ink, an off star the Rounded outline in quaternary ink. */
function Star({ size, filled }: { size: number; filled: boolean }) {
  const colors = useColors()
  return filled
    ? <FilledStarIcon size={size} color={colors.textPrimary} trigger="none" />
    : <RoundedStarIcon size={size} color={colors.textQuaternary} trigger="none" />
}

function StarButton({ star, filled, selected, disabled, still, onPick }: { star: number; filled: boolean; selected: boolean; disabled: boolean; still: boolean; onPick: (star: number) => void }) {
  const styles = useThemed(makeStyles)
  const scale = useSharedValue(1)
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityLabel={`${star} of 5`}
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onPick(star)}
      onPressIn={() => { if (!still) scale.value = withSpring(TAP_SCALE, PRESS_SPRING) }}
      onPressOut={() => { if (!still) scale.value = withSpring(1, PRESS_SPRING) }}
      hitSlop={STAR_SLOP}
      style={[styles.target, disabled ? styles.disabled : null, motion]}
    >
      <Star size={24} filled={filled} />
    </AnimatedPressable>
  )
}

export type RatingProps = {
  label: string
  /** Controlled rating, 1 to 5. */
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  /** Shows the average, with the number of ratings beside it. */
  readOnly?: boolean
  /** How many ratings the average is from. */
  count?: number
  disabled?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Five stars. A tap sets the rating, and screen readers can step it up and down. */
export function Rating({ label, value, defaultValue = 0, onValueChange, readOnly = false, count, disabled = false, animated = true, style }: RatingProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const chosen = value ?? held

  function pick(next: number): void {
    if (value === undefined) setHeld(next)
    onValueChange?.(next)
  }

  if (readOnly) {
    const spoken = `${label}: ${chosen.toFixed(1)} of 5${count === undefined ? '' : ` from ${count} ratings`}`
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={spoken} style={[styles.rating, style]}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.row}>
          <View style={styles.starsSmall}>{STARS.map((star) => <Star key={star} size={16} filled={Math.round(chosen) >= star} />)}</View>
          <Text style={styles.value}>{`${chosen.toFixed(1)}${count === undefined ? '' : ` · ${count} ratings`}`}</Text>
        </View>
      </View>
    )
  }

  return (
    <View
      accessible={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      {...(Platform.OS === 'web' ? {} : { 'aria-valuemin': 0, 'aria-valuemax': 5, 'aria-valuenow': chosen })}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (disabled) return
        if (e.nativeEvent.actionName === 'increment') pick(Math.min(chosen + 1, 5))
        if (e.nativeEvent.actionName === 'decrement') pick(Math.max(chosen - 1, 0))
      }}
      style={[styles.rating, style]}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View style={styles.stars}>
          {STARS.map((star) => <StarButton key={star} star={star} filled={chosen >= star} selected={chosen === star} disabled={disabled} still={still} onPick={pick} />)}
        </View>
        <Text style={styles.value} accessibilityLiveRegion="polite">{chosen ? `${chosen} of 5` : 'No rating'}</Text>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  rating: { width: '100%', maxWidth: 358, gap: space[1.5] },
  label: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  stars: { flexDirection: 'row', gap: space[1] },
  starsSmall: { flexDirection: 'row', gap: space[0.5] },
  target: { alignItems: 'center', justifyContent: 'center', width: 24, height: 24 },
  disabled: { opacity: 0.5 },
  value: { ...type(12, c.textSecondary), lineHeight: 16, fontVariant: ['tabular-nums'] },
})
