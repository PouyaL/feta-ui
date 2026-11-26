import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, type GestureResponderEvent } from 'react-native'
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, softElevation, space, toggleState, useColors, type Colors } from '../kit'
import { EASE_OUT, HEIGHT, PressScale, TARGET, withInk, type PressScaleProps, type Spring } from './button'
import { type, useStill, useThemed } from './card'

const SCALE_PRESS = 0.96
const LIFT_MS = 160

export const TOGGLE_SPRING: Spring = { stiffness: 420, damping: 38, mass: 1 }

export type ToggleProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  /** Controlled state. Leave it out to let the toggle hold its own. */
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  /** `segment` belongs on a tray, inside Toggle Group. Default `ghost`. */
  appearance?: 'ghost' | 'outline' | 'segment'
  icon?: ReactNode
  /** Without text, pass `accessibilityLabel`. */
  children?: string | undefined
  /** Set by Toggle Group: the group paints the lift and slides it behind this toggle. */
  sliding?: boolean
  /** `false` turns off the press scale and the color ease. */
  animated?: boolean
}

type Tone = { fill: [string, string]; ring: [string, string]; ink: [string, string] }

const toneFor = (c: Colors, appearance: NonNullable<ToggleProps['appearance']>, sliding: boolean): Tone => {
  if (appearance === 'outline') return { fill: [c.surface, c.ink5], ring: [c.ink8, c.ink8], ink: [c.textPrimary, c.textPrimary] }
  if (appearance === 'ghost') return { fill: ['transparent', c.ink10], ring: ['transparent', 'transparent'], ink: [c.textSecondary, c.textPrimary] }
  return sliding
    ? { fill: ['transparent', 'transparent'], ring: ['transparent', 'transparent'], ink: [c.textSecondary, c.textPrimary] }
    : { fill: ['transparent', c.surface], ring: ['transparent', c.ink8], ink: [c.textSecondary, c.textPrimary] }
}

/** A button that stays pressed. */
export function Toggle({ pressed, defaultPressed = false, onPressedChange, appearance = 'ghost', icon, children, sliding = false, animated = true, disabled, style, onPress, accessibilityRole = 'togglebutton', accessibilityLabel, accessibilityState, ...rest }: ToggleProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultPressed)
  const on = pressed ?? held
  const tone = toneFor(colors, appearance, sliding)
  const progress = useSharedValue(on ? 1 : 0)

  useEffect(() => {
    progress.value = still ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: LIFT_MS, easing: EASE_OUT })
  }, [on, still, progress])

  const boxStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, [0, 1], tone.fill),
    borderColor: interpolateColor(progress.value, [0, 1], tone.ring),
  }))
  const inkStyle = useAnimatedStyle(() => ({ color: interpolateColor(progress.value, [0, 1], tone.ink) }))

  function handlePress(event: GestureResponderEvent): void {
    onPress?.(event)
    if (pressed === undefined) setHeld(!on)
    onPressedChange?.(!on)
  }

  return (
    <PressScale
      {...(accessibilityRole === 'togglebutton' ? toggleState(on) : { accessibilityRole, 'aria-checked': on })}
      accessibilityLabel={accessibilityLabel ?? children}
      aria-disabled={Boolean(disabled)}
      {...(accessibilityState ? { accessibilityState } : {})}
      still={still}
      scale={SCALE_PRESS}
      spring={TOGGLE_SPRING}
      disabled={disabled}
      hitSlop={(TARGET - HEIGHT.sm) / 2}
      style={[styles.box, disabled && styles.off, appearance === 'segment' && on && !sliding && styles.lifted, boxStyle, style]}
      contentStyle={[styles.content, children ? styles.withText : styles.iconOnly]}
      onPress={handlePress}
      {...rest}
    >
      {withInk(icon, on ? tone.ink[1] : tone.ink[0])}
      {children ? <Animated.Text numberOfLines={1} style={[styles.text, inkStyle]}>{children}</Animated.Text> : null}
    </PressScale>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start', borderRadius: radius.full, borderWidth: 1, height: HEIGHT.sm },
  off: { opacity: 0.4 },
  // The web lift for a segment toggle that is on with no sliding thumb under it.
  lifted: { boxShadow: softElevation(c) },
  content: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[1.5], justifyContent: 'center' },
  withText: { paddingHorizontal: space[2.5] },
  iconOnly: { width: HEIGHT.sm - 2 },
  text: type(14, c.textPrimary, '500'),
})
