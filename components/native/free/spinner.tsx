import { useEffect, useMemo } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Line } from 'react-native-svg'
import { useColors, useReduceMotion } from '../kit'

const SIZES = { xs: 12, s: 16, m: 20, l: 24, xl: 32 } as const
const TURN_MS = { arc: 800, bars: 1000, dots: 0, orbit: 1400 } as const
const BARS = 8
const DOTS = [0, 1, 2] as const
const ARC_SHARE = 0.28
const BREATHE_RISE_MS = 480
const BREATHE_FALL_MS = 720
const DOT_STAGGER_MS = 200
const REDUCED_PULSE_MS = 800
const SPREAD = Easing.bezier(0.4, 0, 0.2, 1)

export type SpinnerProps = {
  /** Default `arc`. */
  kind?: 'arc' | 'bars' | 'dots' | 'orbit'
  /** Named size or points. Default `m`. */
  size?: keyof typeof SIZES | number
  /** Spoken text. Pass `null` when the label beside the spinner already says it. */
  label?: string | null
  /** Milliseconds to wait before showing. Use 300 when the wait may be short. */
  delay?: number
  /** `false` holds the spinner still. */
  animated?: boolean
  /** Default the primary text colour. */
  color?: string
  style?: StyleProp<ViewStyle>
}

function Dot({ size, color, index, moving }: { size: number; color: string; index: number; moving: boolean }) {
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (!moving) {
      cancelAnimation(opacity)
      opacity.value = 1
      return undefined
    }
    opacity.value = 0.3
    opacity.value = withDelay(index * DOT_STAGGER_MS, withRepeat(withSequence(
      withTiming(1, { duration: BREATHE_RISE_MS, easing: SPREAD }),
      withTiming(0.3, { duration: BREATHE_FALL_MS, easing: SPREAD }),
    ), -1))
    return () => cancelAnimation(opacity)
  }, [moving, index, opacity])
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }))
  const dot = useMemo(() => ({ width: size * 0.22, height: size * 0.22, borderRadius: size, backgroundColor: color }), [size, color])
  return <Animated.View style={[dot, fade]} />
}

/** Says something is happening. */
export function Spinner({ kind = 'arc', size = 'm', label = 'Loading', delay = 0, animated = true, color, style }: SpinnerProps) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const ink = color ?? colors.textPrimary
  const px = typeof size === 'number' ? size : SIZES[size]
  const stroke = Math.max(px / 10, 1.5)
  const r = (px - stroke) / 2
  const c = px / 2
  const circumference = 2 * Math.PI * r

  const turn = useSharedValue(0)
  const pulse = useSharedValue(1)
  const shown = useSharedValue(delay > 0 ? 0 : 1)

  useEffect(() => {
    cancelAnimation(turn)
    cancelAnimation(pulse)
    turn.value = 0
    pulse.value = 1
    if (!animated) return undefined
    if (reduce) {
      pulse.value = withRepeat(withSequence(
        withTiming(0.5, { duration: REDUCED_PULSE_MS, easing: Easing.linear }),
        withTiming(1, { duration: REDUCED_PULSE_MS, easing: Easing.linear }),
      ), -1)
    } else if (kind !== 'dots') {
      turn.value = withRepeat(withTiming(1, { duration: TURN_MS[kind], easing: Easing.linear }), -1, false)
    }
    return () => {
      cancelAnimation(turn)
      cancelAnimation(pulse)
    }
  }, [animated, reduce, kind, turn, pulse])

  useEffect(() => {
    if (delay > 0) shown.value = withDelay(delay, withTiming(1, { duration: 1 }))
  }, [delay, shown])

  const stepped = kind === 'bars'
  const rotor = useAnimatedStyle(() => {
    const progress = stepped ? Math.floor(turn.value * BARS) / BARS : turn.value
    return { opacity: pulse.value, transform: [{ rotate: `${progress * 360}deg` }] }
  })
  const reveal = useAnimatedStyle(() => ({ opacity: shown.value }))
  const box = useMemo(() => ({ width: px, height: px }), [px])

  return (
    <Animated.View
      style={[styles.spinner, box, reveal, style]}
      accessible={label !== null}
      aria-hidden={label === null}
      importantForAccessibility={label === null ? 'no-hide-descendants' : 'auto'}
      {...(label === null ? {} : { accessibilityRole: 'progressbar' as const, accessibilityLabel: label })}
    >
      <Animated.View style={[box, rotor]}>
        {kind === 'dots' ? (
          <View style={[box, styles.dots]}>
            {DOTS.map((i) => <Dot key={i} index={i} size={px} color={ink} moving={animated && !reduce} />)}
          </View>
        ) : (
          <Svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} fill="none">
            {kind === 'arc' ? (
              <>
                <Circle cx={c} cy={c} r={r} stroke={ink} strokeOpacity={0.1} strokeWidth={stroke} />
                <Circle cx={c} cy={c} r={r} stroke={ink} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={[circumference * ARC_SHARE, circumference * (1 - ARC_SHARE)]} />
              </>
            ) : null}
            {kind === 'bars' ? Array.from({ length: BARS }, (_, i) => (
              <Line key={i} x1={c} x2={c} y1={px * 0.08} y2={px * 0.3} stroke={ink} strokeWidth={stroke} strokeLinecap="round" opacity={(i + 1) / BARS} transform={`rotate(${(i * 360) / BARS} ${c} ${c})`} />
            )) : null}
            {kind === 'orbit' ? (
              <>
                <Circle cx={c} cy={c} r={r} stroke={ink} strokeOpacity={0.1} strokeWidth={Math.max(px / 20, 1)} />
                <Circle cx={c} cy={stroke * 0.9} r={stroke * 0.9} fill={ink} />
                <Circle cx={c} cy={px - stroke * 0.9} r={stroke * 0.65} fill={ink} />
              </>
            ) : null}
          </Svg>
        )}
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  spinner: { flexShrink: 0 },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
})
