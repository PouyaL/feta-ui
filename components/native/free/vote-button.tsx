import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Polyline } from 'react-native-svg'
import { font, press, pressedState, radius, space, useColors, type Colors } from '../kit'
import { RollingText } from './badge'
import { useStill, useThemed } from './card'

const FADE_MS = 120
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export type VoteButtonProps = {
  /** The count before this person's vote. */
  count: number
  /** Controlled state. */
  voted?: boolean
  defaultVoted?: boolean
  onVotedChange?: (voted: boolean) => void
  /** What the vote is for, like Vote for dark mode. */
  label: string
  disabled?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A chevron over a count. Voting inverts the tile and rolls the count up by one. */
export function VoteButton({ count, voted, defaultVoted = false, onVotedChange, label, disabled = false, animated = true, style }: VoteButtonProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultVoted)
  const on = voted ?? held
  const total = count + (on ? 1 : 0)
  const scale = useSharedValue(1)
  const tint = useSharedValue(on ? colors.inverse : colors.surface)
  useEffect(() => {
    const next = on ? colors.inverse : colors.surface
    tint.value = still ? next : withTiming(next, { duration: FADE_MS, easing: OUT })
  }, [on, colors, still, tint])
  const tile = useAnimatedStyle(() => ({ backgroundColor: tint.value, transform: [{ scale: scale.value }] }))
  const ink = disabled ? colors.textQuaternary : on ? colors.textInverse : colors.textSecondary

  function toggle(): void {
    if (voted === undefined) setHeld(!on)
    onVotedChange?.(!on)
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${total} votes`}
      {...pressedState(on)}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={toggle}
      onPressIn={() => { if (!still) scale.value = withSpring(press.scale, press.spring) }}
      onPressOut={() => { if (!still) scale.value = withSpring(1, press.spring) }}
      style={[styles.vote, on ? styles.on : null, disabled ? styles.disabled : null, tile, style]}
    >
      <Svg aria-hidden width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Polyline points="6 15 12 9 18 15" stroke={ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <RollingText value={String(total)} still={still} style={[styles.count, on ? styles.countOn : null, disabled ? styles.countDisabled : null]} />
    </AnimatedPressable>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  vote: { alignItems: 'center', justifyContent: 'center', minWidth: 48, height: 56, paddingHorizontal: space[1.5], gap: space[0.5], borderRadius: radius.control, borderWidth: 1, borderColor: c.ink8 },
  on: { borderColor: 'transparent' },
  disabled: { borderColor: c.ink5 },
  count: { fontFamily: font.sans, fontSize: 14, lineHeight: 18, fontWeight: '500', letterSpacing: font.tracking(14), fontVariant: ['tabular-nums'], color: c.textPrimary },
  countOn: { color: c.textInverse },
  countDisabled: { color: c.textTertiary },
})
