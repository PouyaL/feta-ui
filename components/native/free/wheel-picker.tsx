import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed } from './card'

const ROW = 40
const VISIBLE = 5
const FLICK = 0.18
const FLICK_WINDOW_MS = 80
const TAP_SLOP = 4
const WHEEL = { stiffness: 260, damping: 28, mass: 1 } as const
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const PERIODS = ['AM', 'PM']

export type WheelPickerProps = {
  /** 24 hour text, like 09:30. */
  value?: string
  defaultValue?: string
  /** Fires from Set time, once every wheel has settled. */
  onValueChange?: (value: string) => void
  /** Pressed on Cancel. Without it there is no Cancel. */
  onCancel?: () => void
  /** Minutes between rows. Default 1. */
  minuteStep?: number
  title?: string
  submitText?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type WheelProps = { label: string; options: string[]; index: number; onIndex: (index: number) => void; onMoving: (moving: boolean) => void; still: boolean }

function Wheel({ label, options, index, onIndex, onMoving, still }: WheelProps) {
  const styles = useThemed(createStyles)
  const y = useSharedValue(-index * ROW)
  const from = useSharedValue(0)
  const last = options.length - 1

  const settle = (next: number): void => {
    'worklet'
    const at = Math.min(last, Math.max(0, next))
    runOnJS(onIndex)(at)
    if (still) {
      y.value = -at * ROW
      runOnJS(onMoving)(false)
      return
    }
    runOnJS(onMoving)(true)
    y.value = withSpring(-at * ROW, WHEEL, (done) => { if (done) runOnJS(onMoving)(false) })
  }

  const pan = Gesture.Pan()
    .activeOffsetY([-4, 4])
    .onStart((e) => {
      cancelAnimation(y)
      from.value = y.value - e.translationY
      runOnJS(onMoving)(true)
    })
    .onUpdate((e) => {
      y.value = Math.min(ROW, Math.max(-(last + 1) * ROW, from.value + e.translationY))
    })
    .onEnd((e) => {
      const speed = Math.abs(e.velocityY) * (FLICK_WINDOW_MS / 1000) > TAP_SLOP ? e.velocityY : 0
      settle(Math.round(-(y.value + speed * FLICK) / ROW))
    })

  const tap = Gesture.Tap().onEnd((e) => {
    settle(Math.round(-y.value / ROW) + Math.round((e.y - (ROW * VISIBLE) / 2) / ROW))
  })

  const reel = useAnimatedStyle(() => ({ transform: [{ translateY: y.value + ROW * 2 }] }))

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        accessible
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        aria-valuemax={last}
        aria-valuemin={0}
        aria-valuenow={index}
        aria-valuetext={options[index] ?? ''}
        collapsable={false}
        style={styles.wheel}
        onAccessibilityAction={(e: AccessibilityActionEvent) => settle(index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      >
        <Animated.View style={reel}>
          {options.map((option, i) => <Text key={option} style={[styles.row, i === index && styles.rowOn]}>{option}</Text>)}
        </Animated.View>
      </View>
    </GestureDetector>
  )
}

/** Three wheels for a time. Set time waits until every wheel has settled. */
export function WheelPicker({ value, defaultValue = '08:41', onValueChange, onCancel, minuteStep = 1, title = 'Pickup time', submitText = 'Set time', animated = true, style }: WheelPickerProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const start = value ?? defaultValue
  const [h24 = 9, m = 0] = start.split(':').map(Number)
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => String(i * minuteStep).padStart(2, '0'))
  const [hour, setHour] = useState((h24 % 12 || 12) - 1)
  const [minute, setMinute] = useState(Math.round(m / minuteStep) % minutes.length)
  const [period, setPeriod] = useState(h24 >= 12 ? 1 : 0)
  const [moving, setMoving] = useState([false, false, false])
  const busy = moving.some(Boolean)
  const mark = (at: number) => (now: boolean): void => setMoving((all) => all.map((one, i) => (i === at ? now : one)))

  useEffect(() => {
    if (minute >= minutes.length) setMinute(0)
  }, [minute, minutes.length])

  function submit(): void {
    const h = ((hour + 1) % 12) + (period === 1 ? 12 : 0)
    onValueChange?.(`${String(h).padStart(2, '0')}:${minutes[minute] ?? '00'}`)
  }

  return (
    <View accessibilityLabel={title} style={[styles.picker, style]}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.reading}>{busy ? 'Settling' : `${String(hour + 1).padStart(2, '0')}:${minutes[minute] ?? '00'} ${PERIODS[period] ?? 'AM'}`}</Text>
      </View>
      <View style={styles.wheels}>
        <View style={styles.band} />
        <Wheel label="Hour" options={HOURS} index={hour} onIndex={setHour} onMoving={mark(0)} still={still} />
        <Wheel label="Minute" options={minutes} index={minute} onIndex={setMinute} onMoving={mark(1)} still={still} />
        <Wheel label="AM or PM" options={PERIODS} index={period} onIndex={setPeriod} onMoving={mark(2)} still={still} />
        <Svg aria-hidden pointerEvents="none" width="100%" height={ROW * VISIBLE} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="mask" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.surface} stopOpacity={1} />
              <Stop offset="0.3" stopColor={colors.surface} stopOpacity={0} />
              <Stop offset="0.7" stopColor={colors.surface} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.surface} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height={ROW * VISIBLE} fill="url(#mask)" />
        </Svg>
      </View>
      <Text style={styles.hint}>Drag or tap a column</Text>
      <View style={styles.actions}>
        {onCancel ? <Button variant="ghost" size="sm" animated={animated} onPress={onCancel}>Cancel</Button> : null}
        <Button size="sm" animated={animated} style={styles.submit} disabled={busy} onPress={submit}>{submitText}</Button>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  picker: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.frame, borderWidth: 1, gap: space[3], padding: space[4], width: '100%' },
  head: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  title: type(16, c.textPrimary, '500'),
  reading: type(12, c.textSecondary, '400', true),
  wheels: { flexDirection: 'row', height: ROW * VISIBLE, overflow: 'hidden' },
  band: { backgroundColor: c.ink5, borderRadius: radius.xl, height: ROW, left: 0, position: 'absolute', right: 0, top: ROW * 2 },
  wheel: { flex: 1, height: '100%', overflow: 'hidden' },
  row: { ...type(16, c.textTertiary, '500'), height: ROW, lineHeight: ROW, textAlign: 'center' },
  rowOn: { color: c.textPrimary },
  hint: { ...type(12, c.textTertiary), textAlign: 'center' },
  actions: { flexDirection: 'row', gap: space[2] },
  submit: { flex: 1 },
})
