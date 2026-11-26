import { useId, useRef, useState } from 'react'
import { Image, StyleSheet, Text, TextInput, View, useColorScheme, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeOut, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { radius, softElevation, space, useColors, type Colors } from '../kit'
import { Button, withInk, SELF } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'

const POINTS_PER_DEGREE = 9
const LIMIT = 15
const SNAP_DEGREES = 0.6
const SETTLE_SPRING = { duration: 450, dampingRatio: 0.9 } as const
const THROW_MS = 120
const STEP = 0.1
const LABELS = [-15, 0, 15] as const
/** The ruler: 14 tall majors every 5 degrees, 8 tall minors 3 down, labels under them. */
const MAJOR = 14
const MINOR = 8
const SCALE_WIDTH = LIMIT * 2 * POINTS_PER_DEGREE
/** Mobile photo height. */
const PHOTO = 230
/** Scaled up so a rotated photo never shows its corners. */
const PHOTO_SCALE = 1.16
const GRID_MS = 150
const AUTO_MS = 700
/** The web's ink-60 in Light and Dark. */
const INK60 = { light: 'rgba(0,0,0,0.6)', dark: 'rgba(255,255,255,0.6)' } as const
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

/** The stand-in photo: a sunset over two ridges, the web demo's scene, drawn at 640 by 360 and cropped to fill. */
export function PhotoScene() {
  const id = `ps${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <Svg aria-hidden width="100%" height="100%" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4f6bff" />
          <Stop offset="0.62" stopColor="#ffb37a" />
        </LinearGradient>
      </Defs>
      <Rect width={640} height={360} fill={`url(#${id})`} />
      <Circle cx={440} cy={150} r={48} fill="#fff3d6" />
      <Path d="M0 230 140 110l100 90 90-70 150 120 160-90v200H0Z" fill="#3f3f6b" />
      <Path d="M0 290c120-50 260-30 360 0s200 20 280-20v90H0Z" fill="#20203f" />
    </Svg>
  )
}

export type PhotoStraightenProps = {
  /** The photo. Leave it out to show the stand-in scene. */
  src?: string
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
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(false)
  const [settled, setSettled] = useState(defaultAngle)
  held.current = settled
  const level = Math.abs(settled + tilt) < SNAP_DEGREES / 2 && tilt !== 0
  const ink60 = useColorScheme() === 'dark' ? INK60.dark : INK60.light

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
    setFailed(false)
    try {
      settle(autoLevel ? await autoLevel() : await new Promise<number>((done) => { setTimeout(() => done(-tilt), still ? 0 : AUTO_MS) }))
    } catch {
      setFailed(true)
    } finally {
      setAuto(false)
    }
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .onBegin(() => { from.value = angle.value; runOnJS(setActive)(true) })
    .onUpdate((e) => { angle.value = clampAngle(from.value - e.translationX / POINTS_PER_DEGREE) })
    .onEnd((e) => { runOnJS(settle)(still ? angle.value : angle.value - ((e.velocityX / 1000) * THROW_MS) / POINTS_PER_DEGREE) })
    .onFinalize(() => { runOnJS(setActive)(false) })

  const photo = useAnimatedStyle(() => ({ transform: [{ rotate: `${angle.value + tilt}deg` }, { scale: PHOTO_SCALE }] }))
  const scale = useAnimatedStyle(() => ({ transform: [{ translateX: -angle.value * POINTS_PER_DEGREE }] }))
  const label = useAnimatedProps(() => ({ text: display(angle.value), defaultValue: display(angle.value) } as TextInputProps))
  const chip = auto ? 'Auto leveling' : failed ? 'Auto failed' : level ? 'Level' : tilt !== 0 ? 'Crooked' : ''
  const chipInk = level ? colors.onSolid : colors.textInverse

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.body}>
        <View style={styles.photo}>
          <Animated.View style={[styles.fill, photo]}>
            {src ? <Image source={{ uri: src }} accessibilityLabel={alt} resizeMode="cover" style={styles.image} /> : <View accessible accessibilityRole="image" accessibilityLabel={alt} style={styles.image}><PhotoScene /></View>}
          </Animated.View>
          {active ? (
            <Animated.View pointerEvents="none" {...(still ? {} : { entering: FadeIn.duration(GRID_MS), exiting: FadeOut.duration(GRID_MS) })} style={styles.fill}>
              {/* The rule-of-thirds grid as plain lines, shown while the ruler is held. A percentage-sized Pattern made
                  react-native-svg on iOS draw tiles many times the box and run out of memory (CALayer setBounds abort). */}
              <Svg aria-hidden width="100%" height="100%">
                {['33.333%', '66.667%'].map((at) => <Line key={`v${at}`} x1={at} y1="0" x2={at} y2="100%" stroke="#ffffff" strokeOpacity={0.45} />)}
                {['33.333%', '66.667%'].map((at) => <Line key={`h${at}`} x1="0" y1={at} x2="100%" y2={at} stroke="#ffffff" strokeOpacity={0.45} />)}
              </Svg>
            </Animated.View>
          ) : null}
          <View accessibilityLiveRegion="polite" style={[styles.chip, level && styles.chipLevel, !chip && styles.chipEmpty]}>
            {auto ? withInk(renderIcon('sparkles', 12), chipInk) : level ? withInk(renderIcon('tick-02', 12), chipInk) : null}
            {chip ? <Text style={[styles.chipText, { color: chipInk }]}>{chip}</Text> : null}
          </View>
        </View>
      </View>
      <View style={styles.controls}>
        <View style={styles.row}>
          <Button style={SELF.center} variant="ghost" shape="pill" size="sm" animated={animated} status={auto ? 'loading' : 'idle'} leadingIcon={renderIcon('sparkles', 16)} onPress={() => { void runAuto() }}>Auto</Button>
          <AnimatedInput aria-hidden tabIndex={-1} editable={false} pointerEvents="none" animatedProps={label} style={[styles.angle, level && styles.angleLevel]} />
          <Button style={SELF.center} variant="ghost" shape="pill" size="sm" animated={animated} disabled={settled === 0} leadingIcon={renderIcon('rotate-ccw', 16)} onPress={() => settle(0)}>Reset</Button>
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
              <Svg aria-hidden width={SCALE_WIDTH + 2} height={MAJOR}>
                {Array.from({ length: LIMIT * 2 + 1 }, (_, i) => (i % 5 === 0
                  ? <Line key={i} x1={i * POINTS_PER_DEGREE + 0.5} x2={i * POINTS_PER_DEGREE + 0.5} y1={0} y2={MAJOR} stroke={ink60} />
                  : <Line key={i} x1={i * POINTS_PER_DEGREE + 0.5} x2={i * POINTS_PER_DEGREE + 0.5} y1={3} y2={3 + MINOR} stroke={colors.ink10} />))}
              </Svg>
              {LABELS.map((value) => <Text key={value} style={[styles.tick, { left: (value + LIMIT) * POINTS_PER_DEGREE - 20 }]}>{value}</Text>)}
            </Animated.View>
            <View style={styles.centre} />
          </View>
        </GestureDetector>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  body: { boxShadow: softElevation(c), padding: space[2], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  photo: { height: PHOTO, overflow: 'hidden', borderRadius: radius.control, backgroundColor: c.ink5 },
  fill: StyleSheet.absoluteFill,
  image: { width: '100%', height: '100%' },
  chip: { position: 'absolute', top: space[2], left: space[2], flexDirection: 'row', alignItems: 'center', gap: space[1], paddingVertical: space[0.5], paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: c.inverse },
  chipLevel: { backgroundColor: c.success },
  chipEmpty: { display: 'none' },
  chipText: { ...type(12, c.textInverse, '500'), lineHeight: 16 },
  controls: { paddingTop: space[2], paddingHorizontal: space[2], paddingBottom: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  angle: { ...type(13, c.textPrimary, '500', true), flex: 1, lineHeight: 16, padding: 0, textAlign: 'center' },
  angleLevel: { color: c.success },
  ruler: { height: 44, overflow: 'hidden', borderRadius: radius.field },
  scale: { position: 'absolute', top: 8, left: '50%', marginLeft: -SCALE_WIDTH / 2, width: SCALE_WIDTH + 2, height: MAJOR },
  tick: { ...type(10, c.textTertiary, '400', true), lineHeight: 14, position: 'absolute', top: 17, textAlign: 'center', width: 40 },
  centre: { position: 'absolute', top: 4, left: '50%', marginLeft: -1, height: 22, width: 2, borderRadius: radius.full, backgroundColor: c.inverse },
})
