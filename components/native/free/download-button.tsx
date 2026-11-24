import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, LayoutAnimationConfig, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { accent, radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT, EASE_OUT_SOFT, HEIGHT, PressScale, withInk, type PressScaleProps } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** One label row: the Mobile label line height. */
const ROW = 22
const ICON = 18
/** The button height on touch screens, which is also the badge's diameter. */
const SIZE = HEIGHT.lg
/** The roll and the colour ease, `--dl-roll` on the web. */
const ROLL_MS = 320
const FOCUS_MS = 120
const WIDTH_MS = 320
const FILL_MS = 240
const TURN_MS = 900
const BOB_HALF_MS = 600
const BOB = 2
const ROLL = { duration: ROLL_MS, easing: EASE_OUT_SOFT }
const ROW_TRAVEL = ROW * 1.1
const ARROW_TRAVEL = ICON * 1.5
/** The arrow points down while downloading. */
const DOWN = 135
const POP_SPRING = { stiffness: 420, damping: 26, mass: 1 }
const SHAKE_STOPS = [-4, 4, -2, 2, 0] as const
/** 360 ms over five legs. */
const SHAKE_LEG = { duration: 72, easing: Easing.bezier(0.25, 0.1, 0.25, 1) }
/** The ring sits 3 in from the badge edge, on a 36 unit circle with a radius of 16. */
const RING_INSET = 3
const RING_BOX = 36
const RING_R = 16
const RING = 2 * Math.PI * RING_R
/** With no size known, a 28% arc turns instead of filling. */
const ARC_GAP = 0.72
/** Room for the hidden copy that measures the next label, so it is never squeezed. */
const MEASURE_ROOM = 640

/** The pill and the badge keep their colours in Light and Dark, so these are fixed. kit.ts has no zinc or orange scale yet. */
const FIXED = {
  pill: accent.onSolid,
  pillPressed: 'rgb(244,244,245)',
  ring: 'rgba(0,0,0,0.08)',
  ink: 'rgb(9,9,11)',
  badge: 'rgb(234,88,12)',
  track: 'rgba(255,255,255,0.28)',
} as const

export type DownloadStatus = 'idle' | 'downloading' | 'done' | 'error'

export type DownloadButtonProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  /** The resting label. Default `Download CV`. */
  label?: string
  /** Where the download stands. You own it: set `downloading` when it starts, then `done` or `error`. */
  status?: DownloadStatus
  /** How far along, from 0 to 1. Leave it out while the size is unknown and the ring turns instead. */
  progress?: number
  doneLabel?: string
  errorLabel?: string
  /** Draws `arrow-up-right`, `tick-02` and `refresh-cw`. Without it the badge shows only the ring. */
  renderIcon?: RenderIcon
  /** `false` keeps the label and arrow in place and swaps statuses with cross fades. The ring still fills. */
  animated?: boolean
}

function rollIn() {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateY: ROW_TRAVEL }] },
    animations: { opacity: withTiming(1, ROLL), transform: [{ translateY: withTiming(0, ROLL) }] },
  }
}

function rollOut() {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: { opacity: withTiming(0, ROLL), transform: [{ translateY: withTiming(-ROW_TRAVEL, ROLL) }] },
  }
}

function popIn() {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.4 }] },
    animations: { opacity: withTiming(1, { duration: FOCUS_MS }), transform: [{ scale: withSpring(1, POP_SPRING) }] },
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

/**
 * A download call to action: a white pill beside an orange badge holding a diagonal arrow. Press or focus rolls the
 * label up and sends the arrow out to the top right as a new one comes in from the bottom left. While downloading,
 * a ring fills round the badge and the label counts the percentage; done pops in a tick, and an error shakes once
 * and offers a retry.
 */
export function DownloadButton({
  label = 'Download CV', status = 'idle', progress, doneLabel = 'Downloaded', errorLabel = 'Try again', renderIcon,
  animated = true, disabled, style, accessibilityLabel, accessibilityState,
  onPress, onPressIn, onPressOut, onHoverIn, onHoverOut, onFocus, onBlur, ...rest
}: DownloadButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const off = Boolean(disabled)
  const idle = status === 'idle'
  const busy = status === 'downloading'
  const known = progress !== undefined
  const pct = known ? Math.round(Math.min(1, Math.max(0, progress)) * 100) : 0
  const text = busy ? (known ? `Downloading ${pct}%` : 'Downloading') : status === 'done' ? doneLabel : status === 'error' ? errorLabel : label
  // The percentage is spoken at its tens, not at every step.
  const spoken = busy && known ? `Downloading ${Math.floor(pct / 10) * 10}%` : text

  const [pressing, setPressing] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const engaged = idle && !off && (pressing || hovering || focused)

  const pillFill = off ? colors.ink5 : pressing && !busy ? FIXED.pillPressed : FIXED.pill
  const badgeFill = off ? colors.ink8 : status === 'error' ? colors.danger : FIXED.badge
  const glyphInk = off ? colors.textQuaternary : accent.onSolid

  const roll = useSharedValue(0)
  const pill = useSharedValue<string>(pillFill)
  const badge = useSharedValue<string>(badgeFill)
  const turn = useSharedValue(busy ? DOWN : 0)
  const bob = useSharedValue(0)
  const spin = useSharedValue(0)
  const dash = useSharedValue(known ? RING * (1 - pct / 100) : RING * ARC_GAP)
  const width = useSharedValue(0)
  const shake = useSharedValue(0)

  useEffect(() => {
    // Still keeps the rows and arrows in place.
    roll.value = still ? 0 : withTiming(engaged ? 1 : 0, ROLL)
  }, [engaged, still, roll])

  useEffect(() => {
    const ease = { duration: still ? FOCUS_MS : ROLL_MS, easing: EASE_OUT_SOFT }
    pill.value = withTiming(pillFill, ease)
    badge.value = withTiming(badgeFill, ease)
  }, [pillFill, badgeFill, still, pill, badge])

  useEffect(() => {
    turn.value = still ? (busy ? DOWN : 0) : withTiming(busy ? DOWN : 0, ROLL)
  }, [busy, still, turn])

  useEffect(() => {
    bob.value = 0
    if (!busy || still) return undefined
    const half = { duration: BOB_HALF_MS, easing: EASE_OUT_SOFT }
    bob.value = withRepeat(withSequence(withTiming(BOB, half), withTiming(0, half)), -1, false)
    return () => cancelAnimation(bob)
  }, [busy, still, bob])

  useEffect(() => {
    spin.value = 0
    if (!busy || known || still) return undefined
    spin.value = withRepeat(withTiming(1, { duration: TURN_MS, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(spin)
  }, [busy, known, still, spin])

  useEffect(() => {
    // The fill carries information, so it eases in every mode.
    dash.value = withTiming(known ? RING * (1 - pct / 100) : RING * ARC_GAP, { duration: FILL_MS, easing: EASE_OUT_SOFT })
  }, [known, pct, dash])

  useEffect(() => {
    if (status !== 'error' || still) return
    shake.value = withSequence(...SHAKE_STOPS.map((stop) => withTiming(stop, SHAKE_LEG)))
  }, [status, still, shake])

  // Each status is announced once as it changes, and the percentage at its tens.
  const announced = useRef(idle ? '' : spoken)
  useEffect(() => {
    const next = idle ? '' : spoken
    if (announced.current === next) return
    announced.current = next
    if (next) AccessibilityInfo.announceForAccessibility(next)
  }, [idle, spoken])

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }))
  const pillStyle = useAnimatedStyle(() => ({ backgroundColor: pill.value }))
  const badgeStyle = useAnimatedStyle(() => ({ backgroundColor: badge.value }))
  const windowStyle = useAnimatedStyle(() => (width.value > 0 ? { width: width.value } : {}))
  const leavingRow = useAnimatedStyle(() => ({ opacity: 1 - roll.value, transform: [{ translateY: -ROW_TRAVEL * roll.value }] }))
  const arrivingRow = useAnimatedStyle(() => ({ opacity: roll.value, transform: [{ translateY: ROW_TRAVEL * (1 - roll.value) }] }))
  const leavingArrow = useAnimatedStyle(() => ({ opacity: 1 - roll.value, transform: [{ translateX: ARROW_TRAVEL * roll.value }, { translateY: -ARROW_TRAVEL * roll.value }] }))
  const arrivingArrow = useAnimatedStyle(() => ({ opacity: roll.value, transform: [{ translateX: -ARROW_TRAVEL * (1 - roll.value) }, { translateY: ARROW_TRAVEL * (1 - roll.value) }] }))
  // The bob runs in screen space, then the turn, as the web's separate `translate` and `rotate` do.
  const arrowsStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }, { rotate: `${turn.value}deg` }] }))
  const ringStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-90 + spin.value * 360}deg` }] }))
  const fillProps = useAnimatedProps(() => ({ strokeDashoffset: dash.value }))

  /** The hidden copy of the label reports its width, and the window eases to it. */
  function handleMeasure(event: LayoutChangeEvent): void {
    const next = Math.ceil(event.nativeEvent.layout.width)
    width.value = width.value === 0 || still ? next : withTiming(next, { duration: WIDTH_MS, easing: EASE_OUT })
  }

  function handlePress(event: GestureResponderEvent): void {
    if (busy) return
    onPress?.(event)
  }

  const arrow = renderIcon ? withInk(renderIcon('arrow-up-right', ICON), glyphInk) : null
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
        disabled={disabled}
        contentStyle={styles.button}
        onPress={handlePress}
        onPressIn={(event: GestureResponderEvent) => { setPressing(true); onPressIn?.(event) }}
        onPressOut={(event: GestureResponderEvent) => { setPressing(false); onPressOut?.(event) }}
        onHoverIn={(event) => { setHovering(true); onHoverIn?.(event) }}
        onHoverOut={(event) => { setHovering(false); onHoverOut?.(event) }}
        onFocus={(event) => { setFocused(true); onFocus?.(event) }}
        onBlur={(event) => { setFocused(false); onBlur?.(event) }}
        {...rest}
      >
        <Animated.View style={[styles.pill, off && styles.pillOff, pillStyle]}>
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.measure}>
            <Text numberOfLines={1} onLayout={handleMeasure} style={styles.row}>{text}</Text>
          </View>

          {/* The window clips the rows as they roll. Every row is absolute, so the window's width comes only from the measure. */}
          <Animated.View style={[styles.window, windowStyle]}>
            <LayoutAnimationConfig skipEntering>
              {idle ? (
                <Animated.View key="idle" entering={enterLabel} exiting={exitLabel} style={styles.layer}>
                  <Animated.Text numberOfLines={1} ellipsizeMode="clip" style={[styles.row, styles.slot, off && styles.rowOff, leavingRow]}>{label}</Animated.Text>
                  <Animated.Text numberOfLines={1} ellipsizeMode="clip" style={[styles.row, styles.slot, off && styles.rowOff, arrivingRow]}>{label}</Animated.Text>
                </Animated.View>
              ) : (
                // The percentage changes in place; only a new status rolls.
                <Animated.View key={status} entering={enterLabel} exiting={exitLabel} style={styles.layer}>
                  <Text numberOfLines={1} ellipsizeMode="clip" style={[styles.row, styles.slot, off && styles.rowOff]}>{text}</Text>
                </Animated.View>
              )}
            </LayoutAnimationConfig>
          </Animated.View>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.badge, badgeStyle]}>
          {busy ? (
            <Animated.View style={[styles.ring, ringStyle]}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${RING_BOX} ${RING_BOX}`} fill="none">
                <Circle cx={RING_BOX / 2} cy={RING_BOX / 2} r={RING_R} stroke={FIXED.track} strokeWidth={2.5} />
                <AnimatedCircle cx={RING_BOX / 2} cy={RING_BOX / 2} r={RING_R} stroke={glyphInk} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={[RING, RING]} animatedProps={fillProps} />
              </Svg>
            </Animated.View>
          ) : null}
          <LayoutAnimationConfig skipEntering>
            {idle || busy ? (
              <Animated.View key="arrows" entering={enterBadge} exiting={exitBadge} style={styles.glyph}>
                <Animated.View style={[styles.glyph, arrowsStyle]}>
                  <Animated.View style={[styles.glyph, leavingArrow]}>{arrow}</Animated.View>
                  <Animated.View style={[styles.glyph, arrivingArrow]}>{arrow}</Animated.View>
                </Animated.View>
              </Animated.View>
            ) : (
              <Animated.View key={status} entering={enterBadge} exiting={exitBadge} style={styles.glyph}>
                {renderIcon ? withInk(renderIcon(status === 'done' ? 'tick-02' : 'refresh-cw', ICON), glyphInk) : null}
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
  button: { alignItems: 'center', flexDirection: 'row', height: SIZE },
  pill: { alignItems: 'center', borderColor: FIXED.ring, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', height: SIZE, overflow: 'hidden', paddingHorizontal: space[6] },
  pillOff: { borderColor: 'transparent' },
  measure: { flexDirection: 'row', left: 0, opacity: 0, position: 'absolute', top: 0, width: MEASURE_ROOM },
  window: { height: ROW, overflow: 'hidden' },
  layer: StyleSheet.absoluteFill,
  row: { ...type(16, FIXED.ink, '600'), lineHeight: ROW },
  rowOff: { color: c.textQuaternary },
  slot: { left: 0, position: 'absolute', top: 0 },
  // The badge overlaps the pill by 2, as on the web.
  badge: { alignItems: 'center', borderRadius: radius.full, height: SIZE, justifyContent: 'center', marginLeft: -space[0.5], overflow: 'hidden', width: SIZE },
  ring: { bottom: RING_INSET, left: RING_INSET, position: 'absolute', right: RING_INSET, top: RING_INSET },
  glyph: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
})
