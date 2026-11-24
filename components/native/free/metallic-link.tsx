import { type ReactNode } from 'react'
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { accent, openLink, radius, space, useColors, type Colors } from '../kit'
import { PressScale, withInk, type PressScaleProps } from './button'
import { type, useStill, useThemed } from './card'

const TURN_MS = 900
const TURN_EASE = Easing.bezier(0.65, 0, 0.3, 1)
const REST_ANGLE = 135
const PRESSED_ANGLE = 315
const RIM = 2
/** Hits the 44 target from the 40 height. */
const SLOP = 2

export type MetallicLinkProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  kind?: 'default' | 'inverted'
  /** The URL to open. */
  href?: string
  /** Usually `arrow-up-right`. */
  icon?: ReactNode
  children?: ReactNode
  /** `false` turns off the sheen, the turning rim and the press scale. */
  animated?: boolean
}

/** A link styled as a pill inside a chrome rim. A press turns the rim and sweeps a sheen. */
export function MetallicLink({ kind = 'default', href, icon, children, animated = true, style, onPress, onPressIn, onPressOut, onLayout, accessibilityLabel, ...rest }: MetallicLinkProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const inverted = kind === 'inverted'
  const angle = useSharedValue(REST_ANGLE)
  const sweep = useSharedValue(0)
  const width = useSharedValue(0)
  const height = useSharedValue(0)

  // Linear stops on a square that turns behind the face stand in for the web's conic rim.
  const rimStyle = useAnimatedStyle(() => {
    const side = Math.hypot(width.value, height.value)
    return { height: side, left: (width.value - side) / 2, top: (height.value - side) / 2, transform: [{ rotate: `${angle.value}deg` }], width: side }
  })
  const sheenStyle = useAnimatedStyle(() => ({ opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0, transform: [{ translateX: (-1.2 + sweep.value * 3.4) * width.value }] }))

  function handleIn(event: GestureResponderEvent): void {
    if (!still) {
      angle.value = withTiming(PRESSED_ANGLE, { duration: TURN_MS, easing: TURN_EASE })
      sweep.value = 0
      sweep.value = withTiming(1, { duration: TURN_MS, easing: TURN_EASE })
    }
    onPressIn?.(event)
  }

  function handleOut(event: GestureResponderEvent): void {
    if (!still) angle.value = withTiming(REST_ANGLE, { duration: TURN_MS, easing: TURN_EASE })
    onPressOut?.(event)
  }

  function handleLayout(event: LayoutChangeEvent): void {
    width.value = event.nativeEvent.layout.width
    height.value = event.nativeEvent.layout.height
    onLayout?.(event)
  }

  function handlePress(event: GestureResponderEvent): void {
    onPress?.(event)
    if (href) openLink(href)
  }

  return (
    <PressScale
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
      still={still}
      hitSlop={SLOP}
      style={[styles.box, style]}
      contentStyle={styles.rim}
      onPress={handlePress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      onLayout={handleLayout}
      {...rest}
    >
      <Animated.View pointerEvents="none" style={[styles.chrome, rimStyle]}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="chrome" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.muted} />
              <Stop offset="0.17" stopColor={colors.textQuaternary} />
              <Stop offset="0.33" stopColor={colors.textTertiary} />
              <Stop offset="0.5" stopColor={colors.textSecondary} />
              <Stop offset="0.67" stopColor={colors.textTertiary} />
              <Stop offset="0.83" stopColor={colors.textQuaternary} />
              <Stop offset="1" stopColor={colors.muted} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#chrome)" />
        </Svg>
      </Animated.View>
      <View style={[styles.face, inverted && styles.faceInverted]}>
        {inverted ? null : <View style={styles.tint} />}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sheenStyle]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0.27">
                <Stop offset="0.35" stopColor={accent.onSolid} stopOpacity={0} />
                <Stop offset="0.5" stopColor={accent.onSolid} stopOpacity={0.28} />
                <Stop offset="0.65" stopColor={accent.onSolid} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#sheen)" />
          </Svg>
        </Animated.View>
        <Text numberOfLines={1} style={[styles.label, inverted && styles.labelInverted]}>{children}</Text>
        {withInk(icon, inverted ? colors.textInverse : colors.textPrimary)}
      </View>
    </PressScale>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  rim: { borderRadius: radius.full, height: 40, overflow: 'hidden', padding: RIM },
  chrome: { position: 'absolute' },
  face: { alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.full, flex: 1, flexDirection: 'row', gap: space[1.5], overflow: 'hidden', paddingLeft: space[3.5], paddingRight: space[3] },
  faceInverted: { backgroundColor: c.inverse },
  tint: { ...StyleSheet.absoluteFill, backgroundColor: c.ink5 },
  label: type(16, c.textPrimary, '500'),
  labelInverted: { color: c.textInverse },
})
