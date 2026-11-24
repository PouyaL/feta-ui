import { useRef, useState } from 'react'
import { Image, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Line, Rect } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'

const POINTS_PER_DEGREE = 9
const LIMIT = 15
const SNAP_DEGREES = 0.6
const SETTLE_SPRING = { duration: 450, dampingRatio: 0.9 } as const
const THROW_MS = 120
const STEP = 0.1
const LABELS = [-15, 0, 15] as const
const TICK = 18
const AnimatedInput = Animated.createAnimatedComponent(TextInput)

const clampAngle = (value: number): number => {
  'worklet'
  return Math.min(LIMIT, Math.max(-LIMIT, value))
}
const display = (angle: number): string => {
  'worklet'
  return `${angle < 0 ? '−' : ''}${Math.abs(angle).toFixed(1)}°`
}
const round = (value: number): number => Math.round(value * 10) / 10

export type PhotoStraightenProps = {
  src: string
  alt: string
  /** The photo's tilt in degrees. The correction starts at 0. */
  tilt?: number
  defaultAngle?: number
  /** Works out the correction. Without it, Auto uses the opposite of `tilt`. */
  autoLevel?: () => Promise<number>
  onChange?: (angle: number) => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Levels a tilted horizon. The ruler throws, settles on a spring and snaps to level. */
export function PhotoStraighten({ src, alt, tilt = 0, defaultAngle = 0, autoLevel, onChange, renderIcon, animated = true, style }: PhotoStraightenProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const angle = useSharedValue(defaultAngle)
  const from = useSharedValue(defaultAngle)
  const held = useRef(defaultAngle)
  const [auto, setAuto] = useState(false)
  const [settled, setSettled] = useState(defaultAngle)
  held.current = settled
  const level = Math.abs(settled + tilt) < SNAP_DEGREES / 2 && tilt !== 0

  function settle(target: number): void {
    const end = round(Math.abs(target + tilt) <= SNAP_DEGREES ? -tilt : Math.abs(target) <= SNAP_DEGREES ? 0 : clampAngle(target))
    setSettled(end)
    onChange?.(end)
    angle.value = still ? end : withSpring(end, SETTLE_SPRING)
  }

  function nudge(by: number): void {
    const next = clampAngle(round(held.current + by))
    angle.value = next
    setSettled(next)
    onChange?.(next)
  }

  async function runAuto(): Promise<void> {
    setAuto(true)
    try {
      settle(autoLevel ? await autoLevel() : -tilt)
    } finally {
      setAuto(false)
    }
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .onBegin(() => { from.value = angle.value })
    .onUpdate((e) => { angle.value = clampAngle(from.value - e.translationX / POINTS_PER_DEGREE) })
    .onEnd((e) => { runOnJS(settle)(still ? angle.value : angle.value - ((e.velocityX / 1000) * THROW_MS) / POINTS_PER_DEGREE) })

  const photo = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value + tilt}deg` }, { scale: 1.2 }] }))
  const scale = useAnimatedStyle(() => ({ transform: [{ translateX: -angle.value * POINTS_PER_DEGREE }] }))
  const label = useAnimatedProps(() => ({ text: display(angle.value), defaultValue: display(angle.value) } as TextInputProps))

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.body}>
        <View style={styles.photo}>
          <Animated.View style={[styles.fill, photo]}>
            <Image source={{ uri: src }} accessibilityLabel={alt} resizeMode="cover" style={styles.image} />
          </Animated.View>
          <View pointerEvents="none" style={styles.fill}>
            {/* The rule-of-thirds grid as plain lines. A percentage-sized Pattern made react-native-svg on iOS draw tiles
                many times the box and run out of memory (CALayer setBounds abort). */}
            <Svg width="100%" height="100%">
              {['33.333%', '66.667%'].map((at) => (
                <Line key={`v${at}`} x1={at} y1="0" x2={at} y2="100%" stroke={colors.surface} strokeOpacity={0.4} />
              ))}
              {['33.333%', '66.667%'].map((at) => (
                <Line key={`h${at}`} x1="0" y1={at} x2="100%" y2={at} stroke={colors.surface} strokeOpacity={0.4} />
              ))}
              <Rect x="0.5" y="0.5" width="99.5%" height="99.5%" fill="none" stroke={colors.surface} strokeOpacity={0.4} />
            </Svg>
          </View>
          <View accessibilityLiveRegion="polite" style={styles.chip}>
            {auto ? renderIcon('sparkles', 14) : level ? renderIcon('tick-02', 14) : null}
            <Text style={styles.chipText}>{auto ? 'Auto leveling' : level ? 'Level' : tilt !== 0 ? 'Crooked' : 'Straighten'}</Text>
          </View>
        </View>
      </View>
      <View style={styles.controls}>
        <View style={styles.row}>
          <Button variant="ghost" shape="pill" size="sm" animated={animated} status={auto ? 'loading' : 'idle'} leadingIcon={renderIcon('sparkles', 16)} onPress={() => { void runAuto() }}>Auto</Button>
          <AnimatedInput editable={false} pointerEvents="none" animatedProps={label} style={styles.angle} />
          <Button variant="ghost" shape="pill" size="sm" animated={animated} disabled={settled === 0} leadingIcon={renderIcon('rotate-ccw', 16)} onPress={() => settle(0)}>Reset</Button>
        </View>
        <GestureDetector gesture={pan}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Straighten"
            aria-valuemin={-LIMIT}
            aria-valuemax={LIMIT}
            aria-valuenow={settled}
            aria-valuetext={`${settled} degrees`}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? STEP : -STEP)}
            style={styles.ruler}
          >
            <Animated.View style={[styles.scale, scale]}>
              <Svg width={LIMIT * 2 * POINTS_PER_DEGREE + 2} height={TICK}>
                {Array.from({ length: LIMIT * 2 + 1 }, (_, i) => <Line key={i} x1={i * POINTS_PER_DEGREE + 1} x2={i * POINTS_PER_DEGREE + 1} y1={0} y2={i % 5 === 0 ? TICK : TICK / 2} stroke={colors.ink10} />)}
              </Svg>
              <View style={styles.labels}>{LABELS.map((value) => <Text key={value} style={styles.tick}>{value}</Text>)}</View>
            </Animated.View>
            <View style={styles.centre} />
          </View>
        </GestureDetector>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  body: { padding: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  photo: { aspectRatio: 3 / 2, overflow: 'hidden', borderRadius: radius.xl, backgroundColor: c.ink5 },
  fill: StyleSheet.absoluteFill,
  image: { width: '100%', height: '100%' },
  chip: { position: 'absolute', top: space[2], alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: space[1], paddingVertical: space[0.5], paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: c.surface },
  chipText: type(12, c.textPrimary, '500'),
  controls: { gap: space[2], paddingVertical: space[2], paddingHorizontal: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  angle: { ...type(14, c.textPrimary, '500', true), padding: 0, textAlign: 'center' },
  ruler: { height: 48, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scale: { alignItems: 'center' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  tick: type(11, c.textTertiary, '400', true),
  centre: { position: 'absolute', top: 0, height: TICK + 2, width: 2, borderRadius: radius.full, backgroundColor: c.textPrimary },
})
