import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, LayoutAnimationConfig, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { accent, radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT, EASE_OUT_SOFT, HEIGHT, PRESS_SPRING, PressScale, withInk, type PressScaleProps } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { Spinner } from './spinner'

/** One label row: the Mobile label line height. */
const ROW = 22
const ICON = 16
/** The roll and the colour ease, `--ra-roll` on the web. */
const ROLL_MS = 360
const FOCUS_MS = 120
const WIDTH_MS = 320
const ROLL = { duration: ROLL_MS, easing: EASE_OUT_SOFT }
const ROW_TRAVEL = ROW * 1.1
const ARROW_TRAVEL = ICON * 1.6
const LEAVE_SCALE = 0.92
const ARRIVE_SCALE = 1.08
/** The web press, `scalePress - 0.01`. */
const PRESS_SCALE = 0.97
const POP_SPRING = { stiffness: 420, damping: 26, mass: 1 }
const SHAKE_STOPS = [-5, 5, -3, 3, 0] as const
/** 360 ms over five legs. */
const SHAKE_LEG = { duration: 72, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
/** Room for the hidden copy that measures the next label, so it is never squeezed. */
const MEASURE_ROOM = 640
/** Badge inset on every side. */
const INSET = space[1]

/** Mercury keeps its look in Light and Dark, so these are fixed. kit.ts has no zinc scale yet. */
const MERCURY = {
  zinc50: 'rgb(250,250,250)',
  zinc200: 'rgb(228,228,231)',
  zinc300: 'rgb(212,212,216)',
  zinc400: 'rgb(161,161,170)',
  zinc900: 'rgb(24,24,27)',
  black: 'rgb(0,0,0)',
  rim: 'rgba(24,24,27,0.14)',
} as const

/** The web fill: a bright band on top, a darker waist and a light reflection low down. */
const MERCURY_STOPS = [
  { offset: 0, color: MERCURY.zinc50 },
  { offset: 0.28, color: MERCURY.zinc200 },
  { offset: 0.54, color: MERCURY.zinc300 },
  { offset: 0.6, color: MERCURY.zinc400 },
  { offset: 0.82, color: MERCURY.zinc200 },
  { offset: 1, color: MERCURY.zinc50 },
] as const

export type RollArrowStatus = 'idle' | 'loading' | 'success' | 'error'

export type RollArrowButtonProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  /** The resting label. Default `Get started`. */
  label?: string
  /** Where the action stands. You own it: set `loading` when the work starts, then `success` or `error`. */
  status?: RollArrowStatus
  loadingLabel?: string
  successLabel?: string
  errorLabel?: string
  /** Mercury, a liquid silver gradient, keeps its look in Light and Dark. Ink follows the theme. Default `mercury`. */
  tone?: 'mercury' | 'ink'
  /** Default `lg`: 52 tall, `md` is 44. */
  size?: 'md' | 'lg'
  /** Replaces the arrow in the badge while idle. */
  icon?: ReactNode
  /** Draws `arrow-up-02` (turned to point right), `tick-02` and `refresh-cw`. Without it the badge shows only `icon` and the spinner. */
  renderIcon?: RenderIcon
  /** `false` keeps the label and arrow in place, turns off the press scale, and swaps statuses with cross fades. */
  animated?: boolean
}

function rollIn() {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateY: ROW_TRAVEL }, { scale: ARRIVE_SCALE }] },
    animations: { opacity: withTiming(1, ROLL), transform: [{ translateY: withTiming(0, ROLL) }, { scale: withTiming(1, ROLL) }] },
  }
}

function rollOut() {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
    animations: { opacity: withTiming(0, ROLL), transform: [{ translateY: withTiming(-ROW_TRAVEL, ROLL) }, { scale: withTiming(LEAVE_SCALE, ROLL) }] },
  }
}

function popIn() {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.4 }, { rotate: '-30deg' }] },
    animations: { opacity: withTiming(1, { duration: FOCUS_MS }), transform: [{ scale: withSpring(1, POP_SPRING) }, { rotate: withSpring('0deg', POP_SPRING) }] },
  }
}

function popOut() {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ scale: 1 }] },
    animations: { opacity: withTiming(0, { duration: FOCUS_MS }), transform: [{ scale: withSpring(0.4, POP_SPRING) }] },
  }
}

const fadeIn = FadeIn.duration(FOCUS_MS)
const fadeOut = FadeOut.duration(FOCUS_MS)

const mercuryStyles = StyleSheet.create({
  clip: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  svg: { left: 0, position: 'absolute', top: 0 },
})

/** The liquid silver fill. The gradient is vertical, so a fixed wide Svg clipped by the pill looks the same at any width: no layout state, no render while the pill grows. */
function MercuryFill() {
  return (
    <View pointerEvents="none" style={mercuryStyles.clip}>
      <Svg aria-hidden width={MEASURE_ROOM} height="100%" style={mercuryStyles.svg}>
        <Defs>
          <LinearGradient id="mercury" x1="0" y1="0" x2="0" y2="1">
            {MERCURY_STOPS.map((stop) => <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />)}
          </LinearGradient>
        </Defs>
        <Rect width={MEASURE_ROOM} height="100%" fill="url(#mercury)" />
      </Svg>
    </View>
  )
}

/**
 * A pill call to action with a round arrow badge. Press or focus rolls the label up and trades the arrow, the old
 * one out to the right and a new one in from the left. Statuses roll in the same way: a spinner while loading, a
 * tick on success, a shake and a retry arrow on error.
 */
export function RollArrowButton({
  label = 'Get started', status = 'idle', loadingLabel = 'Starting', successLabel = 'You’re in', errorLabel = 'Try again',
  tone = 'mercury', size = 'lg', icon, renderIcon, animated = true, disabled, style, accessibilityLabel, accessibilityState,
  onPress, onPressIn, onPressOut, onHoverIn, onHoverOut, onFocus, onBlur, ...rest
}: RollArrowButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const off = Boolean(disabled)
  const busy = status === 'loading'
  const idle = status === 'idle'
  const mercury = tone === 'mercury' && !off
  const text = status === 'loading' ? loadingLabel : status === 'success' ? successLabel : status === 'error' ? errorLabel : label

  const [pressing, setPressing] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const engaged = idle && !off && (pressing || hovering || focused)
  // Statuses read at full strength, like the engaged label.
  const hot = !off && (engaged || !idle)

  const restInk = off ? colors.textQuaternary : tone === 'mercury' ? MERCURY.zinc900 : colors.textInverse
  const hotInk = off ? colors.textQuaternary : tone === 'mercury' ? MERCURY.black : colors.textInverse
  // Ink rests at 72%, the web `color-mix` on the inverse text.
  const restAlpha = tone === 'ink' && !off ? 0.72 : 1
  const badgeFill = off ? colors.ink8 : status === 'success' ? colors.success : status === 'error' ? colors.danger : tone === 'mercury' ? MERCURY.zinc900 : colors.surface
  const badgeInk = off ? colors.textQuaternary : status === 'success' || status === 'error' ? colors.onSolid : tone === 'mercury' ? accent.onSolid : colors.textPrimary

  const roll = useSharedValue(0)
  const ink = useSharedValue<string>(restInk)
  const alpha = useSharedValue(restAlpha)
  const fill = useSharedValue<string>(badgeFill)
  const width = useSharedValue(0)
  const shake = useSharedValue(0)

  useEffect(() => {
    // Still keeps the rows and arrows in place: only the colour deepens.
    roll.value = still ? 0 : withTiming(engaged ? 1 : 0, ROLL)
  }, [engaged, still, roll])

  useEffect(() => {
    const ease = { duration: still ? FOCUS_MS : ROLL_MS, easing: EASE_OUT_SOFT }
    ink.value = withTiming(hot ? hotInk : restInk, ease)
    alpha.value = withTiming(hot ? 1 : restAlpha, ease)
    fill.value = withTiming(badgeFill, ease)
  }, [hot, hotInk, restInk, restAlpha, badgeFill, still, ink, alpha, fill])

  useEffect(() => {
    if (status !== 'error' || still) return
    shake.value = withSequence(...SHAKE_STOPS.map((stop) => withTiming(stop, SHAKE_LEG)))
  }, [status, still, shake])

  // Each status is announced once as it changes; the resting label is not.
  const announced = useRef(status)
  useEffect(() => {
    if (announced.current === status) return
    announced.current = status
    if (status !== 'idle') AccessibilityInfo.announceForAccessibility(text)
  }, [status, text])

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }))
  const windowStyle = useAnimatedStyle(() => (width.value > 0 ? { width: width.value, opacity: alpha.value } : { opacity: alpha.value }))
  const inkStyle = useAnimatedStyle(() => ({ color: ink.value }))
  const leavingRow = useAnimatedStyle(() => ({ opacity: 1 - roll.value, transform: [{ translateY: -ROW_TRAVEL * roll.value }, { scale: 1 - (1 - LEAVE_SCALE) * roll.value }] }))
  const arrivingRow = useAnimatedStyle(() => ({ opacity: roll.value, transform: [{ translateY: ROW_TRAVEL * (1 - roll.value) }, { scale: ARRIVE_SCALE - (ARRIVE_SCALE - 1) * roll.value }] }))
  const leavingArrow = useAnimatedStyle(() => ({ opacity: 1 - roll.value, transform: [{ translateX: ARROW_TRAVEL * roll.value }] }))
  const arrivingArrow = useAnimatedStyle(() => ({ opacity: roll.value, transform: [{ translateX: -ARROW_TRAVEL * (1 - roll.value) }] }))
  const badgeStyle = useAnimatedStyle(() => ({ backgroundColor: fill.value }))

  /** The hidden copy of the label reports its width, and the window eases to it. */
  function handleMeasure(event: LayoutChangeEvent): void {
    const next = Math.ceil(event.nativeEvent.layout.width)
    width.value = width.value === 0 || still ? next : withTiming(next, { duration: WIDTH_MS, easing: EASE_OUT })
  }

  function handlePress(event: GestureResponderEvent): void {
    if (busy) return
    onPress?.(event)
  }

  // The long arrow is the upward one, turned to point right. The ink goes to the icon, not the turning box.
  const arrow = icon ? withInk(icon, badgeInk) : renderIcon ? <View style={styles.turned}>{withInk(renderIcon('arrow-up-02', ICON), badgeInk)}</View> : null
  const enterLabel = still ? fadeIn : rollIn
  const exitLabel = still ? fadeOut : rollOut
  const enterBadge = still ? fadeIn : popIn
  const exitBadge = still ? fadeOut : popOut

  return (
    <Animated.View style={[styles.box, shakeStyle, style]}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? text}
        accessibilityState={{ disabled: off || busy, busy, ...accessibilityState }}
        // The aria props reach React Native Web too, which no longer reads accessibilityState.
        aria-busy={busy}
        aria-disabled={off || busy}
        still={still || busy}
        scale={PRESS_SCALE}
        spring={PRESS_SPRING}
        disabled={disabled}
        contentStyle={[styles.pill, size === 'md' ? styles.pillMd : styles.pillLg, tone === 'ink' && styles.ink, mercury && styles.mercury, off && styles.pillOff]}
        onPress={handlePress}
        onPressIn={(event: GestureResponderEvent) => { setPressing(true); onPressIn?.(event) }}
        onPressOut={(event: GestureResponderEvent) => { setPressing(false); onPressOut?.(event) }}
        onHoverIn={(event) => { setHovering(true); onHoverIn?.(event) }}
        onHoverOut={(event) => { setHovering(false); onHoverOut?.(event) }}
        onFocus={(event) => { setFocused(true); onFocus?.(event) }}
        onBlur={(event) => { setFocused(false); onBlur?.(event) }}
        {...rest}
      >
        {mercury ? (
          <MercuryFill />
        ) : null}
        {/* The 1 px rim sits on top, so it does not shift the badge inset. */}
        {mercury ? <View pointerEvents="none" style={styles.rim} /> : null}

        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.measure}>
          <Text numberOfLines={1} onLayout={handleMeasure} style={styles.row}>{text}</Text>
        </View>

        {/* The window clips the rows as they roll. Every row is absolute, so the window's width comes only from the measure. */}
        <Animated.View style={[styles.window, windowStyle]}>
          <LayoutAnimationConfig skipEntering>
            {idle ? (
              <Animated.View key="idle" entering={enterLabel} exiting={exitLabel} style={styles.layer}>
                <Animated.Text numberOfLines={1} ellipsizeMode="clip" style={[styles.row, styles.slot, inkStyle, leavingRow]}>{label}</Animated.Text>
                <Animated.Text numberOfLines={1} ellipsizeMode="clip" style={[styles.row, styles.slot, inkStyle, arrivingRow]}>{label}</Animated.Text>
              </Animated.View>
            ) : (
              <Animated.View key={status} entering={enterLabel} exiting={exitLabel} style={styles.layer}>
                <Animated.Text numberOfLines={1} ellipsizeMode="clip" style={[styles.row, styles.slot, inkStyle]}>{text}</Animated.Text>
              </Animated.View>
            )}
          </LayoutAnimationConfig>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.badge, size === 'md' ? styles.badgeMd : styles.badgeLg, badgeStyle]}>
          <LayoutAnimationConfig skipEntering>
            {idle ? (
              <Animated.View key="idle" entering={enterBadge} exiting={exitBadge} style={styles.glyph}>
                <Animated.View style={[styles.glyph, leavingArrow]}>{arrow}</Animated.View>
                <Animated.View style={[styles.glyph, arrivingArrow]}>{arrow}</Animated.View>
              </Animated.View>
            ) : status === 'loading' ? (
              <Animated.View key="loading" entering={enterBadge} exiting={exitBadge} style={styles.glyph}>
                <Spinner size={ICON} color={badgeInk} label={null} animated={animated} />
              </Animated.View>
            ) : (
              <Animated.View key={status} entering={enterBadge} exiting={exitBadge} style={styles.glyph}>
                {renderIcon ? withInk(renderIcon(status === 'success' ? 'tick-02' : 'refresh-cw', ICON), badgeInk) : null}
              </Animated.View>
            )}
          </LayoutAnimationConfig>
        </Animated.View>
      </PressScale>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  pill: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', overflow: 'hidden', paddingRight: INSET },
  pillLg: { gap: space[4], height: HEIGHT.lg, paddingLeft: space[6] },
  pillMd: { gap: space[3], height: HEIGHT.md, paddingLeft: space[4] },
  mercury: { backgroundColor: MERCURY.zinc300 },
  rim: { ...StyleSheet.absoluteFill, borderColor: MERCURY.rim, borderRadius: radius.full, borderWidth: 1 },
  ink: { backgroundColor: c.inverse },
  pillOff: { backgroundColor: c.ink5 },
  measure: { flexDirection: 'row', left: 0, opacity: 0, position: 'absolute', top: 0, width: MEASURE_ROOM },
  window: { height: ROW, overflow: 'hidden' },
  layer: { ...StyleSheet.absoluteFill, transformOrigin: 'left center' },
  row: { ...type(16, c.textPrimary, '500'), lineHeight: ROW },
  slot: { left: 0, position: 'absolute', top: 0, transformOrigin: 'left center' },
  badge: { alignItems: 'center', borderRadius: radius.full, justifyContent: 'center', overflow: 'hidden' },
  badgeLg: { height: HEIGHT.lg - INSET * 2, width: HEIGHT.lg - INSET * 2 },
  badgeMd: { height: HEIGHT.md - INSET * 2, width: HEIGHT.md - INSET * 2 },
  glyph: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  turned: { transform: [{ rotate: '90deg' }] },
})
