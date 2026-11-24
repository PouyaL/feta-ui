import { useEffect, useState } from 'react'
import { StyleSheet, View, type GestureResponderEvent } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { PressScale, type PressScaleProps } from './button'
import { type, useStill, useThemed } from './card'

const ROW = 22
const SLIDE_MS = 320
const FADE_MS = 120
const SLIDE_EASE = Easing.bezier(0.77, 0, 0.175, 1)
/** Hits the 44 target from the 40 height. */
const SLOP = 2

export type SlideTextButtonProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  label?: string
  /** The label that rises in while pressed, hovered with a pointer, or focused. */
  hoverLabel?: string
  variant?: 'primary' | 'secondary'
  /** `false` keeps the label in place and turns off the press scale. */
  animated?: boolean
}

/** The label slides up one row while pressed, hovered or focused, and a second label rises in. */
export function SlideTextButton({ label = 'Get started', hoverLabel = 'Let’s go', variant = 'primary', animated = true, disabled, style, onPressIn, onPressOut, onHoverIn, onHoverOut, onFocus, onBlur, accessibilityState, ...rest }: SlideTextButtonProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const off = Boolean(disabled)
  const [pressing, setPressing] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const shown = !off && (pressing || hovering || focused)
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withTiming(shown ? 1 : 0, still ? { duration: FADE_MS, easing: Easing.linear } : { duration: SLIDE_MS, easing: SLIDE_EASE })
  }, [shown, still, progress])

  const firstStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value, transform: [{ translateY: still ? 0 : -ROW * progress.value }] }))
  const secondStyle = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ translateY: still ? -ROW : -ROW * progress.value }] }))

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, ...accessibilityState }}
      still={still}
      disabled={disabled}
      hitSlop={SLOP}
      style={[styles.box, style]}
      contentStyle={[styles.button, variant === 'primary' ? styles.primary : styles.secondary, off && styles.buttonOff]}
      pressedStyle={variant === 'primary' ? styles.primaryPressed : styles.secondaryPressed}
      onPressIn={(event: GestureResponderEvent) => { setPressing(true); onPressIn?.(event) }}
      onPressOut={(event: GestureResponderEvent) => { setPressing(false); onPressOut?.(event) }}
      onHoverIn={(event) => { setHovering(true); onHoverIn?.(event) }}
      onHoverOut={(event) => { setHovering(false); onHoverOut?.(event) }}
      onFocus={(event) => { setFocused(true); onFocus?.(event) }}
      onBlur={(event) => { setFocused(false); onBlur?.(event) }}
      {...rest}
    >
      {/* Stacked in a one row window: both labels size the button, so it never changes width. */}
      <View style={styles.window}>
        <Animated.Text numberOfLines={1} style={[styles.row, variant === 'primary' ? styles.inkInverse : styles.inkPrimary, off && styles.inkOff, firstStyle]}>{label}</Animated.Text>
        <Animated.Text numberOfLines={1} style={[styles.row, variant === 'primary' ? styles.inkInverse : styles.inkPrimary, off && styles.inkOff, secondStyle]}>{hoverLabel}</Animated.Text>
      </View>
    </PressScale>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  button: { alignItems: 'center', borderRadius: radius.xl, height: 40, justifyContent: 'center', paddingHorizontal: space[6] },
  primary: { backgroundColor: c.inverse },
  primaryPressed: { opacity: 0.8 },
  secondary: { backgroundColor: c.ink5 },
  secondaryPressed: { backgroundColor: c.ink10 },
  buttonOff: { backgroundColor: c.ink5 },
  window: { alignItems: 'center', height: ROW, overflow: 'hidden' },
  row: { ...type(16, c.textPrimary, '500'), lineHeight: ROW },
  inkPrimary: { color: c.textPrimary },
  inkInverse: { color: c.textInverse },
  inkOff: { color: c.textQuaternary },
})
