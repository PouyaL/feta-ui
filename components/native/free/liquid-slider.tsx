import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeIn, FadeOut, ZoomIn, cancelAnimation, runOnJS, useAnimatedProps, useAnimatedStyle, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const VIEW_WIDTH = 120
const VIEW_HEIGHT = 200
const GLASS_WIDTH = 112
const GLASS_HEIGHT = 190
const RIM = 9
const COLUMNS = 34
const SPREAD = 2600
const TENSION = 30
const DAMPING = 2.4
const BULGE = 14
const STEP_S = 1 / 120
const SCALE = [1, 0.75, 0.5, 0.25, 0]
const NOTE_OUT_MS = 120
const BUBBLE_MS = 1400
const BUBBLES = [{ left: '12%', delay: 0 }, { left: '32%', delay: 300 }, { left: '52%', delay: 700 }, { left: '72%', delay: 150 }, { left: '88%', delay: 900 }] as const
const LEVEL = { stiffness: 220, damping: 26, mass: 1 } as const
const STAMP = { stiffness: 500, damping: 22, mass: 1 } as const
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const GLASS_SHAPE = `M1 ${RIM}V${VIEW_HEIGHT - RIM}A59 ${RIM} 0 0 0 ${VIEW_WIDTH - 1} ${VIEW_HEIGHT - RIM}V${RIM}`

const AnimatedPath = Animated.createAnimatedComponent(Path)
const fullIn = ZoomIn.springify().stiffness(STAMP.stiffness).damping(STAMP.damping).mass(STAMP.mass).withInitialValues({ transform: [{ scale: 0.7 }] })

const clamp = (value: number, low: number, high: number): number => {
  'worklet'
  return Math.min(high, Math.max(low, value))
}

export type LiquidSliderProps = {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** The accessible name and the card's title. */
  label?: string
  unit?: string
  /** Below this share of the range, the card says so. Default .2. */
  lowAt?: number
  lowText?: string
  fullText?: string
  disabled?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Bubble({ left, delay }: { left: string; delay: number }) {
  const styles = useThemed(createStyles)
  const rise = useSharedValue(0)
  useEffect(() => {
    rise.value = withDelay(delay, withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: BUBBLE_MS, easing: OUT })), -1))
    return () => cancelAnimation(rise)
  }, [delay, rise])
  const move = useAnimatedStyle(() => ({ left: left as `${number}%`, opacity: 1 - rise.value, transform: [{ translateY: rise.value * -150 }] }))
  return <Animated.View style={[styles.bubble, move]} />
}

/** A glass that fills as you drag. The surface is 34 small springs, and it rests when the energy is gone. */
export function LiquidSlider({ value, defaultValue = 1250, onValueChange, min = 0, max = 2000, step = 50, label = 'Water today', unit = 'ml', lowAt = 0.2, lowText = 'Drink up', fullText = 'Goal reached', disabled = false, animated = true, style }: LiquidSliderProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const [dragging, setDragging] = useState(false)
  const current = value ?? held
  const share = (current - min) / (max - min)
  const level = useSharedValue(share)
  const heights = useSharedValue<number[]>(Array.from({ length: COLUMNS }, () => 0))
  const speeds = useSharedValue<number[]>(Array.from({ length: COLUMNS }, () => 0))
  const pull = useSharedValue(-1)
  /** True while the level spring runs, so the surface stays awake until it lands. */
  const settling = useSharedValue(false)

  function rest(): void {
    if (pull.value >= 0) return
    sim.setActive(false)
    heights.value = Array.from({ length: COLUMNS }, () => 0)
    speeds.value = Array.from({ length: COLUMNS }, () => 0)
  }

  const sim = useFrameCallback((frame) => {
    const gap = Math.min(1 / 30, (frame.timeSincePreviousFrame ?? 16) / 1000)
    const target = pull.value
    const h = heights.value.slice()
    const v = speeds.value.slice()
    for (let t = 0; t < gap; t += STEP_S) {
      for (let i = 0; i < COLUMNS; i++) {
        const left = h[Math.max(0, i - 1)] ?? 0
        const right = h[Math.min(COLUMNS - 1, i + 1)] ?? 0
        const here = h[i] ?? 0
        const lean = target < 0 ? 0 : -BULGE * Math.exp(-(((i - target) / 4) ** 2))
        v[i] = (v[i] ?? 0) + (SPREAD * (left + right - 2 * here) - TENSION * (here - lean) - DAMPING * (v[i] ?? 0)) * STEP_S
      }
      for (let i = 0; i < COLUMNS; i++) h[i] = (h[i] ?? 0) + (v[i] ?? 0) * STEP_S
    }
    heights.value = h
    speeds.value = v
    let energy = 0
    for (let i = 0; i < COLUMNS; i++) energy += Math.abs(h[i] ?? 0) + Math.abs(v[i] ?? 0)
    if (energy <= 0.4 && target < 0 && !settling.value) runOnJS(rest)()
  }, false)

  const water = useAnimatedProps(() => {
    const top = RIM + (1 - level.value) * (VIEW_HEIGHT - RIM * 2)
    let d = `M0 ${VIEW_HEIGHT}`
    for (let i = 0; i < COLUMNS; i++) d += `L${((i / (COLUMNS - 1)) * VIEW_WIDTH).toFixed(1)} ${(top + (heights.value[i] ?? 0)).toFixed(1)}`
    return { d: `${d}L${VIEW_WIDTH} ${VIEW_HEIGHT}Z` }
  })

  useEffect(() => {
    if (still) {
      sim.setActive(false)
      heights.value = Array.from({ length: COLUMNS }, () => 0)
      speeds.value = Array.from({ length: COLUMNS }, () => 0)
      level.value = share
      return
    }
    settling.value = true
    level.value = withSpring(share, LEVEL, () => { settling.value = false })
    sim.setActive(true)
  }, [share, still, level, sim, heights, speeds, settling])

  function commit(next: number): void {
    const snapped = Math.min(max, Math.max(min, min + Math.round((next - min) / step) * step))
    if (snapped === current) return
    setHeld(snapped)
    onValueChange?.(snapped)
  }

  function slosh(strength: number): void {
    if (still) return
    speeds.modify((v) => {
      'worklet'
      for (let i = 0; i < COLUMNS; i++) v[i] = (v[i] ?? 0) + strength * (i / (COLUMNS - 1) - 0.5)
      return v
    })
    sim.setActive(true)
  }

  const fromTouch = (x: number, y: number): void => {
    'worklet'
    runOnJS(commit)(min + (1 - y / GLASS_HEIGHT) * (max - min))
    if (!still) pull.value = clamp(x / GLASS_WIDTH, 0, 1) * (COLUMNS - 1)
  }

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .minDistance(0)
    .onBegin((e) => {
      runOnJS(setDragging)(true)
      fromTouch(e.x, e.y)
    })
    .onUpdate((e) => fromTouch(e.x, e.y))
    .onEnd(() => runOnJS(slosh)(40))
    .onFinalize(() => {
      pull.value = -1
      runOnJS(setDragging)(false)
    })

  const low = share < lowAt
  const full = current >= max

  return (
    <View style={[styles.card, disabled && styles.disabled, style]}>
      <View style={styles.head}>
        <Text style={styles.title}>{label}</Text>
        <Text style={styles.value}>GOAL {max.toLocaleString('en-US')}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.reading}>
          <Text style={styles.number}>{current.toLocaleString('en-US')}</Text>
          <Text style={styles.of}>{unit} of {max.toLocaleString('en-US')}</Text>
        </View>
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
            style={styles.glass}
            onAccessibilityAction={(e: AccessibilityActionEvent) => {
              if (disabled) return
              commit(current + (e.nativeEvent.actionName === 'increment' ? step : -step))
              slosh(60)
            }}
          >
            <Svg aria-hidden width={GLASS_WIDTH} height={GLASS_HEIGHT} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
              <Defs><ClipPath id="glass"><Path d={`${GLASS_SHAPE}Z`} /></ClipPath></Defs>
              <G clipPath="url(#glass)"><AnimatedPath animatedProps={water} fill={colors.textTertiary} /></G>
              <Path d={GLASS_SHAPE} fill="none" stroke={colors.ink10} strokeWidth={1.5} />
              <Ellipse cx={VIEW_WIDTH / 2} cy={RIM} fill="none" rx={VIEW_WIDTH / 2 - 1} ry={RIM - 1} stroke={colors.ink10} strokeWidth={1.5} />
            </Svg>
            {dragging && !still ? <View pointerEvents="none" style={styles.bubbles}>{BUBBLES.map((bubble) => <Bubble key={bubble.left} left={bubble.left} delay={bubble.delay} />)}</View> : null}
            {dragging ? <View pointerEvents="none" style={styles.grab}><Text style={styles.grabText}>Dragging</Text></View> : null}
          </View>
        </GestureDetector>
        <View style={styles.scale}>
          {SCALE.map((at) => <Text key={at} style={styles.value}>{Math.round(min + at * (max - min)).toLocaleString('en-US')}</Text>)}
        </View>
      </View>
      <View accessibilityLiveRegion="polite" style={styles.note}>
        {full ? (
          <Animated.View key="full" {...(still ? {} : { entering: fullIn, exiting: FadeOut.duration(NOTE_OUT_MS) })} style={styles.full}>
            <Text style={styles.fullText}>{fullText}</Text>
          </Animated.View>
        ) : low ? <Animated.Text key="low" {...(still ? {} : { entering: FadeIn.duration(NOTE_OUT_MS), exiting: FadeOut.duration(NOTE_OUT_MS) })} style={styles.lowText}>{lowText}</Animated.Text> : null}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.frame, borderWidth: 1, gap: space[3], padding: space[5], width: '100%' },
  disabled: { opacity: 0.5 },
  head: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  title: type(16, c.textPrimary, '500'),
  value: type(12, c.textTertiary, '400', true),
  body: { alignItems: 'stretch', flexDirection: 'row', gap: space[3] },
  reading: { flex: 1, justifyContent: 'flex-end' },
  number: { ...type(28, c.textPrimary, '600', true), lineHeight: 34 },
  of: type(14, c.textSecondary),
  glass: { borderRadius: radius.control, height: GLASS_HEIGHT, width: GLASS_WIDTH },
  bubbles: { bottom: space[3], left: space[3], overflow: 'hidden', position: 'absolute', right: space[3], top: space[5] },
  bubble: { backgroundColor: c.ink10, borderRadius: radius.full, bottom: -8, height: 5, position: 'absolute', width: 5 },
  grab: { alignSelf: 'center', backgroundColor: c.inverse, borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: space[0.5], position: 'absolute', top: GLASS_HEIGHT / 2 - space[2] },
  grabText: type(12, c.textInverse, '500'),
  scale: { justifyContent: 'space-between', paddingVertical: space[1] },
  note: { alignItems: 'center', minHeight: 22 },
  full: { backgroundColor: c.ink5, borderRadius: radius.full, paddingHorizontal: space[2.5], paddingVertical: space[0.5] },
  fullText: type(14, c.success),
  lowText: type(14, c.textSecondary),
})
