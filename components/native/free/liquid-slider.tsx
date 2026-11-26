import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, useColorScheme, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeIn, FadeOut, ZoomIn, cancelAnimation, runOnJS, useAnimatedProps, useAnimatedStyle, useFrameCallback, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle, Defs, Ellipse, FeGaussianBlur, Filter, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { radius, softElevation, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

/*
 * Drawn as the web's Mobile glass, 112 by 202: wall gradient, rim, base slab, two shines, a glint, the water body with
 * its depth wash, the surface ellipse with its meniscus, bubbles and a soft shadow. The surface's tilt is drawn into
 * the ellipse path (an arc's x-axis rotation) on the UI thread, where the web rotates a group.
 */
const W = 112
const H = 202
/** Space under the water: the base ellipse and slab. */
const BASE = 27
/** The water's surface at the top of the range sits 16 below the glass top, under the rim. */
const BRIM = 16
const BOTTOM = H - BASE
const COLUMNS = 34
const SPREAD = 2600
const TENSION = 30
const DAMPING = 2.4
const BULGE = 14
const STEP_S = 1 / 120
const MAX_TILT = 10
const SCALE = [1, 0.75, 0.5, 0.25, 0]
const NOTE_OUT_MS = 120
const BUBBLE_MS = 1400
/** Bubbles at rest, as on the web's Default frame: x on its 120 wide glass, radius, share of the water's depth. */
const REST_BUBBLES = [[42.5, 2.5, 0.527], [75.5, 1.5, 0.286], [59, 1, 0.141]] as const
const RISING = [{ left: '20%', delay: 0 }, { left: '38%', delay: 300 }, { left: '56%', delay: 700 }, { left: '74%', delay: 150 }] as const
const LEVEL = { stiffness: 220, damping: 26, mass: 1 } as const
const STAMP = { stiffness: 500, damping: 22, mass: 1 } as const
const OUT = Easing.bezier(0.23, 1, 0.32, 1)

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const AnimatedRect = Animated.createAnimatedComponent(Rect)
const fullIn = ZoomIn.springify().stiffness(STAMP.stiffness).damping(STAMP.damping).mass(STAMP.mass).withInitialValues({ transform: [{ scale: 0.7 }] })

const clamp = (value: number, low: number, high: number): number => {
  'worklet'
  return Math.min(high, Math.max(low, value))
}

/** The surface line's height, mean offset and tilt in degrees, from the column heights. */
const surfaceOf = (level: number, h: number[]): { top: number; middle: number; tilt: number } => {
  'worklet'
  const top = BOTTOM - level * (BOTTOM - BRIM)
  const span = W - 6
  let mean = 0
  for (let i = 0; i < COLUMNS; i++) mean += h[i] ?? 0
  mean /= COLUMNS
  let lean = 0
  let spread = 0
  for (let i = 0; i < COLUMNS; i++) {
    const x = (i / (COLUMNS - 1) - 0.5) * span
    lean += x * ((h[i] ?? 0) - mean)
    spread += x * x
  }
  const tilt = clamp((Math.atan2(lean / spread, 1) * 180) / Math.PI, -MAX_TILT, MAX_TILT)
  return { top, middle: top + mean, tilt }
}

/** A tilted ellipse as a path: two arcs between the ends of its long axis. */
const ellipsePath = (cx: number, cy: number, rx: number, ry: number, tilt: number): string => {
  'worklet'
  const a = (tilt * Math.PI) / 180
  const dx = rx * Math.cos(a)
  const dy = rx * Math.sin(a)
  const x1 = (cx - dx).toFixed(2)
  const y1 = (cy - dy).toFixed(2)
  const x2 = (cx + dx).toFixed(2)
  const y2 = (cy + dy).toFixed(2)
  return `M${x1} ${y1}A${rx} ${ry} ${tilt.toFixed(2)} 1 0 ${x2} ${y2}A${rx} ${ry} ${tilt.toFixed(2)} 1 0 ${x1} ${y1}Z`
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

/** A bubble at rest, held at its share of the water's depth as the level moves. */
function RestBubble({ x, r, at, level, heights, fill, stroke }: { x: number; r: number; at: number; level: SharedValue<number>; heights: SharedValue<number[]>; fill: string; stroke: string }) {
  const place = useAnimatedProps(() => ({ cy: BOTTOM - at * (BOTTOM - surfaceOf(level.value, heights.value).middle) }))
  return <AnimatedCircle animatedProps={place} cx={x * (W / 120)} cy={BOTTOM} r={r - 0.375} fill={fill} stroke={stroke} strokeWidth={0.75} />
}

function Bubble({ left, delay }: { left: string; delay: number }) {
  const styles = useThemed(createStyles)
  const rise = useSharedValue(0)
  useEffect(() => {
    rise.value = withDelay(delay, withRepeat(withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: BUBBLE_MS, easing: OUT })), -1))
    return () => cancelAnimation(rise)
  }, [delay, rise])
  const move = useAnimatedStyle(() => ({ left: left as `${number}%`, opacity: rise.value < 0.2 ? rise.value * 5 : 1 - (rise.value - 0.2) / 0.8, transform: [{ translateY: 8 - rise.value * 36 }] }))
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
    const top = BOTTOM - level.value * (BOTTOM - BRIM)
    const span = W - 6
    let d = `M3 ${BOTTOM}`
    for (let i = 0; i < COLUMNS; i++) d += `L${(3 + (i / (COLUMNS - 1)) * span).toFixed(1)} ${(top + (heights.value[i] ?? 0)).toFixed(1)}`
    return { d: `${d}L${W - 3} ${BOTTOM}Z` }
  })
  const surface = useAnimatedProps(() => {
    const { middle, tilt } = surfaceOf(level.value, heights.value)
    return { d: ellipsePath(W / 2, middle, W / 2 - 3.5, 6.5, tilt) }
  })
  const meniscus = useAnimatedProps(() => {
    const { middle, tilt } = surfaceOf(level.value, heights.value)
    return { d: ellipsePath(W / 2, middle, W / 2 - 7.5, 4.5, tilt) }
  })
  const grab = useAnimatedProps(() => ({ y: surfaceOf(level.value, heights.value).middle - 3 }))

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
    runOnJS(commit)(min + ((BOTTOM - y) / (BOTTOM - BRIM)) * (max - min))
    if (!still) pull.value = clamp(x / W, 0, 1) * (COLUMNS - 1)
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
  const dark = useColorScheme() === 'dark'
  const ink60 = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'
  const white = '#ffffff'
  // Gradient stops take a solid colour plus stopOpacity: an rgba stopColor renders black on iOS.
  const inkBase = dark ? '#ffffff' : '#000000'
  const fmt = (n: number): string => n.toLocaleString('en-US')

  return (
    <View style={[styles.card, disabled && styles.disabled, style]}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>{label}</Text>
        <Text style={styles.meta}>GOAL {fmt(max)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.readout}>
          <View accessibilityLiveRegion="polite" style={(full || low) && styles.note}>
            {full ? (
              <Animated.View key="full" {...(still ? {} : { entering: fullIn, exiting: FadeOut.duration(NOTE_OUT_MS) })} style={styles.full}>
                <View style={styles.badge}><Text style={styles.badgeTick}>✓</Text></View>
                <Text style={styles.fullText}>{fullText}</Text>
              </Animated.View>
            ) : low ? <Animated.Text key="low" {...(still ? {} : { entering: FadeIn.duration(NOTE_OUT_MS), exiting: FadeOut.duration(NOTE_OUT_MS) })} style={styles.lowText}>{lowText}</Animated.Text> : null}
          </View>
          <Text style={styles.number}>{fmt(current)}</Text>
          <Text style={styles.of}>{unit} of {fmt(max)}</Text>
        </View>
        <View style={styles.gauge}>
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
              <Svg aria-hidden width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={styles.svg}>
                <Defs>
                  <Filter id="ls-b8" x={-40} y={H - 50} width={W + 80} height={70} filterUnits="userSpaceOnUse"><FeGaussianBlur stdDeviation={4} /></Filter>
                  <Filter id="ls-b2" x={-10} y={H - 30} width={W + 20} height={34} filterUnits="userSpaceOnUse"><FeGaussianBlur stdDeviation={1} /></Filter>
                  <LinearGradient id="ls-wall" x1="0" x2="1" y1="0" y2="0">
                    <Stop offset="0" stopColor={inkBase} stopOpacity={0.08} /><Stop offset="0.16" stopColor={inkBase} stopOpacity={0.04} /><Stop offset="0.82" stopColor={inkBase} stopOpacity={0.04} /><Stop offset="1" stopColor={inkBase} stopOpacity={0.1} />
                  </LinearGradient>
                  <LinearGradient id="ls-body" x1="0" x2="1" y1="0" y2="0">
                    <Stop offset="0" stopColor={inkBase} stopOpacity={0.1} /><Stop offset="0.3" stopColor={inkBase} stopOpacity={0.08} /><Stop offset="0.75" stopColor={inkBase} stopOpacity={0.08} /><Stop offset="1" stopColor={inkBase} stopOpacity={0.1} />
                  </LinearGradient>
                  <LinearGradient id="ls-top" x1="0" x2="0" y1="0" y2="1">
                    <Stop offset="0" stopColor={inkBase} stopOpacity={0.04} /><Stop offset="1" stopColor={inkBase} stopOpacity={0.08} />
                  </LinearGradient>
                  <LinearGradient id="ls-shine" x1="0" x2="0" y1="0" y2="1">
                    <Stop offset="0" stopColor={white} stopOpacity={0.9} /><Stop offset="1" stopColor={white} stopOpacity={0} />
                  </LinearGradient>
                  <LinearGradient id="ls-glint" x1="0" x2="1" y1="0" y2="0">
                    <Stop offset="0" stopColor={white} stopOpacity={0} /><Stop offset="0.5" stopColor={white} stopOpacity={0.9} /><Stop offset="1" stopColor={white} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Ellipse cx={W / 2} cy={H - 13} rx={W / 2 + 18} ry={11} fill={colors.ink8} filter="url(#ls-b8)" />
                <Ellipse cx={W / 2} cy={H - 13} rx={W / 2 + 1} ry={5} fill={colors.ink10} filter="url(#ls-b2)" />
                <Rect x={0} y={9} width={W} height={H - 36} fill="url(#ls-wall)" />
                <Ellipse cx={W / 2} cy={9} rx={W / 2 - 0.5} ry={8.5} fill={colors.ink4} stroke={colors.ink10} strokeWidth={1} />
                <Ellipse cx={W / 2} cy={H - 21} rx={W / 2} ry={9} fill={colors.surface} />
                <Ellipse cx={W / 2} cy={H - 21} rx={W / 2} ry={9} fill={colors.ink10} />
                <Rect x={0} y={H - 27} width={W} height={6} fill={colors.surface} />
                <Rect x={0} y={H - 27} width={W} height={6} fill={colors.ink10} />
                <Ellipse cx={W / 2} cy={H - 27} rx={W / 2 - 3} ry={7} fill={colors.ink10} />
                <AnimatedPath animatedProps={water} fill="url(#ls-body)" />
                {REST_BUBBLES.map(([x, r, at]) => <RestBubble key={x} x={x} r={r} at={at} level={level} heights={heights} fill={colors.surface} stroke={ink60} />)}
                <AnimatedPath animatedProps={surface} fill="url(#ls-top)" stroke={ink60} strokeWidth={1} />
                <AnimatedPath animatedProps={meniscus} fill="none" stroke={colors.surface} strokeWidth={1} />
                {dragging ? <AnimatedRect animatedProps={grab} x={W / 2 - 14} y={0} width={28} height={6} rx={3} fill={colors.surface} stroke={colors.ink10} strokeWidth={1} /> : null}
                <Rect x={0} y={9} width={1.5} height={H - 30} fill={colors.ink10} />
                <Rect x={W - 1.5} y={9} width={1.5} height={H - 30} fill={colors.ink10} />
                <Rect x={3} y={11} width={1} height={H - 36} fill={colors.ink5} />
                <Rect x={W - 4} y={11} width={1} height={H - 36} fill={colors.ink5} />
                <Rect x={11} y={23} width={8} height={(H - 36) * 0.7} rx={4} fill="url(#ls-shine)" />
                <Rect x={W - 15} y={31} width={3} height={(H - 36) * 0.4} rx={1.5} fill="url(#ls-shine)" opacity={0.78} />
                <Path d={`M1 9A${W / 2 - 1} 8 0 0 0 ${W - 1} 9`} fill="none" stroke={colors.ink10} strokeWidth={2} />
                <Path d="M14.4 13C18.97 13.69 24.87 14.27 31.7 14.7C38.52 15.14 46.12 15.41 54 15.5" fill="none" stroke={colors.surface} strokeWidth={1.5} strokeLinecap="round" />
                <Path d={`M1 ${H - 21}A${W / 2 - 1} 8 0 0 0 ${W - 1} ${H - 21}`} fill="none" stroke={colors.ink10} strokeWidth={1.5} />
                <Ellipse cx={46.8} cy={H - 15.5} rx={30} ry={1.5} fill="url(#ls-glint)" />
              </Svg>
              {dragging && !still ? <View pointerEvents="none" style={styles.bubbles}>{RISING.map((b) => <Bubble key={b.left} left={b.left} delay={b.delay} />)}</View> : null}
            </View>
          </GestureDetector>
          <View aria-hidden style={styles.marks}>
            {SCALE.map((at) => <Text key={at} style={styles.mark}>{fmt(Math.round(min + at * (max - min)))}</Text>)}
          </View>
        </View>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.ink4, borderRadius: radius.frame, padding: space[1], width: '100%' },
  disabled: { opacity: 0.4 },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[3], justifyContent: 'space-between', paddingBottom: space[2.5], paddingLeft: space[3.5], paddingRight: space[3], paddingTop: space[2.5] },
  title: { ...type(14, c.textPrimary, '600'), flexShrink: 1, lineHeight: 20 },
  meta: { ...type(10, c.textSecondary, '500', true), lineHeight: 12 },
  body: { boxShadow: softElevation(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, gap: space[3], paddingBottom: space[4], paddingLeft: space[5], paddingRight: space[4], paddingTop: space[4] },
  readout: { gap: space[0.5] },
  note: { alignItems: 'flex-start', paddingBottom: space[2] },
  number: { ...type(32, c.textPrimary, '700', true), lineHeight: 38 },
  of: { ...type(12, c.textSecondary), lineHeight: 16 },
  gauge: { alignItems: 'flex-end', flexDirection: 'row', gap: space[3], justifyContent: 'flex-end' },
  glass: { height: H, marginHorizontal: space[2.5], marginVertical: space[2], width: W },
  svg: { overflow: 'visible' },
  bubbles: { bottom: BASE, left: 4, overflow: 'hidden', position: 'absolute', right: 4, top: BRIM },
  bubble: { backgroundColor: c.surface, borderColor: c.textSecondary, borderRadius: radius.full, borderWidth: 0.75, bottom: 0, height: 5, position: 'absolute', width: 5 },
  marks: { height: H + 5, justifyContent: 'space-between', paddingBottom: 29 },
  mark: { ...type(10, c.textTertiary, '500', true), lineHeight: 10 },
  full: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', gap: space[1.5], paddingLeft: space[1], paddingRight: space[2.5], paddingVertical: 3 },
  badge: { alignItems: 'center', backgroundColor: c.success, borderRadius: radius.full, height: 16, justifyContent: 'center', width: 16 },
  badgeTick: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
  fullText: { ...type(12, c.success, '500'), lineHeight: 16 },
  lowText: { ...type(12, c.textSecondary, '500'), lineHeight: 16 },
})
