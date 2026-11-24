import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { cancelAnimation, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated'
import Svg, { Line } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { RollingText, iconFor } from './label'

const SWEEP = 270
const SIZE = 240
const CENTER = SIZE / 2
const DEAD_ZONE = 14
const PULL = 0.65
const OVERSHOOT = 10
const REPEAT_MS = 120
const COAST = 0.32
const OFF_OPACITY = 0.1
/** Only the last 80 ms of movement counts as a flick. */
const FLICK_WINDOW_MS = 80
const SETTLE = { duration: 350, dampingRatio: 0.8 } as const

const AnimatedLine = Animated.createAnimatedComponent(Line)

export type DetentDialProps = {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  unit?: string
  disabled?: boolean
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Tick({ index, count, angle, color }: { index: number; count: number; angle: SharedValue<number>; color: string }) {
  const at = (index / (count - 1)) * SWEEP - SWEEP / 2
  const major = index % 4 === 0 ? 2 : 0
  const props = useAnimatedProps(() => {
    const distance = (at - angle.value) / 16
    return {
      strokeOpacity: at <= angle.value + 0.01 ? 1 : OFF_OPACITY,
      y2: 16 + 6 + major + 7 * Math.exp(-distance * distance),
    }
  })
  return <AnimatedLine animatedProps={props} stroke={color} strokeLinecap="round" strokeWidth={2} transform={`rotate(${at} ${CENTER} ${CENTER})`} x1={CENTER} x2={CENTER} y1={16} />
}

/** A rotary control that clicks into steps. It follows the finger, coasts on a flick and settles. */
export function DetentDial({ value, defaultValue = 21, onValueChange, min = 16, max = 30, step = 0.5, label = 'Temperature', unit = '°C', disabled = false, renderIcon, animated = true, style }: DetentDialProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const repeat = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const [held, setHeld] = useState(defaultValue)
  const [turning, setTurning] = useState(false)
  const current = value ?? held
  const span = max - min
  const count = Math.round(span / step) + 1
  const toAngle = (v: number): number => {
    'worklet'
    return ((v - min) / span) * SWEEP - SWEEP / 2
  }
  const fromAngle = (a: number): number => {
    'worklet'
    return min + ((a + SWEEP / 2) / SWEEP) * span
  }
  const snap = (v: number): number => {
    'worklet'
    return Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step))
  }
  const angle = useSharedValue(toAngle(current))
  const latest = useSharedValue(current)
  const last = useSharedValue({ angle: 0, at: 0, speed: 0 })
  const atLimit = current === min || current === max
  const pointer = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value}deg` }] }))

  useEffect(() => () => clearInterval(repeat.current), [])

  useEffect(() => {
    latest.value = current
  }, [current, latest])

  useEffect(() => {
    if (atLimit) clearInterval(repeat.current)
  }, [atLimit])

  function commit(next: number): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function settle(next: number): void {
    commit(next)
    latest.value = next
    cancelAnimation(angle)
    angle.value = still ? toAngle(next) : withSpring(toAngle(next), SETTLE)
  }

  const onMove = (x: number, y: number, time: number): void => {
    'worklet'
    const dx = x - CENTER
    const dy = y - CENTER
    if (Math.hypot(dx, dy) < DEAD_ZONE) return
    const raw = (Math.atan2(dx, -dy) * 180) / Math.PI
    const limit = SWEEP / 2
    // Past either end, resistance grows up to the overshoot.
    const beyond = Math.abs(raw) > limit ? limit + Math.min(OVERSHOOT, (Math.abs(raw) - limit) / 3) : Math.abs(raw)
    const free = Math.sign(raw) * beyond
    const target = Math.abs(raw) > limit ? (still ? Math.sign(raw) * limit : free) : free
    const clamped = Math.max(-limit, Math.min(limit, target))
    const near = snap(fromAngle(clamped))
    const pulled = Math.abs(raw) > limit ? target : target + (toAngle(near) - target) * PULL
    const dt = Math.max(1, time - last.value.at)
    last.value = { angle: pulled, at: time, speed: ((pulled - last.value.angle) / dt) * 1000 }
    angle.value = pulled
    if (near !== latest.value) {
      latest.value = near
      runOnJS(commit)(near)
    }
  }

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0)
    .onBegin(() => {
      cancelAnimation(angle)
      last.value = { angle: angle.value, at: Date.now(), speed: 0 }
      runOnJS(setTurning)(true)
    })
    .onUpdate((e) => onMove(e.x, e.y, Date.now()))
    .onFinalize(() => {
      const speed = still || Date.now() - last.value.at > FLICK_WINDOW_MS ? 0 : last.value.speed
      const coast = speed * COAST * 0.2
      const limit = SWEEP / 2
      const next = snap(fromAngle(Math.max(-limit, Math.min(limit, angle.value + coast))))
      runOnJS(setTurning)(false)
      if (next !== latest.value) {
        latest.value = next
        runOnJS(commit)(next)
      }
      angle.value = still ? toAngle(next) : withSpring(toAngle(next), { ...SETTLE, velocity: speed })
    })

  function hold(direction: number): void {
    let at = current
    const move = (): void => { at = snap(at + direction * step); settle(at) }
    move()
    clearInterval(repeat.current)
    repeat.current = setInterval(move, REPEAT_MS)
  }

  const release = (): void => clearInterval(repeat.current)
  const ink = atLimit ? colors.danger : colors.textPrimary

  const stepper = (direction: number, name: 'minus' | 'plus', title: string, off: boolean) => (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      aria-disabled={off}
      disabled={off}
      style={[styles.step, off && styles.stepOff]}
      onPressIn={() => hold(direction)}
      onPressOut={release}
    >
      {iconFor(renderIcon, name, 16, colors.textPrimary)}
    </Pressable>
  )

  return (
    <View style={[styles.tray, disabled && styles.disabled, style]}>
      <View style={styles.card}>
        <GestureDetector gesture={pan}>
          <View
            accessible
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            accessibilityLabel={label}
            accessibilityRole="adjustable"
            aria-disabled={disabled}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={current}
            aria-valuetext={`${current} ${unit}`}
            collapsable={false}
            style={styles.dial}
            onAccessibilityAction={(e: AccessibilityActionEvent) => { if (!disabled) settle(snap(current + (e.nativeEvent.actionName === 'increment' ? step : -step))) }}
          >
            <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
              {Array.from({ length: count }, (_, i) => <Tick key={i} index={i} count={count} angle={angle} color={ink} />)}
            </Svg>
            <View style={styles.knob}>
              <Animated.View style={[StyleSheet.absoluteFill, pointer]}>
                <View style={[styles.indicator, atLimit && styles.indicatorLimit]} />
              </Animated.View>
              <View style={[styles.readout, turning && styles.readoutTurning]}>
                <RollingText value={current.toFixed(1)} still={still} style={styles.value} />
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.range}>{min} to {max}{unit}</Text>
              </View>
            </View>
          </View>
        </GestureDetector>
      </View>
      <View style={styles.footer}>
        {stepper(-1, 'minus', `Lower ${label}`, disabled || current === min)}
        <Text style={styles.now}>{disabled ? 'Locked' : `Now ${current.toFixed(1)}${unit}`}</Text>
        {stepper(1, 'plus', `Raise ${label}`, disabled || current === max)}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: 300, padding: space[1], width: '100%' },
  disabled: { opacity: 0.5 },
  card: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: space[3] },
  dial: { alignItems: 'center', height: SIZE, justifyContent: 'center', width: SIZE },
  knob: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, height: SIZE * 0.64, justifyContent: 'center', width: SIZE * 0.64 },
  indicator: { alignSelf: 'center', backgroundColor: c.textPrimary, borderRadius: radius.xs, height: 10, marginTop: space[1.5], width: 3 },
  indicatorLimit: { backgroundColor: c.danger },
  readout: { alignItems: 'center' },
  readoutTurning: { opacity: 0.75 },
  value: { ...type(34, c.textPrimary, '600'), lineHeight: 40 },
  label: type(12, c.textSecondary),
  range: type(10, c.textSecondary, '400', true),
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', padding: space[2] },
  step: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 44, justifyContent: 'center', width: 44 },
  stepOff: { opacity: 0.4 },
  now: type(10, c.textSecondary, '400', true),
})
