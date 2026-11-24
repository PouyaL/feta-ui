import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Defs, Ellipse, LinearGradient, Mask, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { accent, radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT_SOFT, TARGET, useLoop, withInk, type Spring } from './button'
import { type, useStill, useThemed } from './card'

const SWITCH_AT = 22
const REACH = 46
const ELASTIC = 0.12
const CORD_X = 179
const CORD_TOP = 121
const CORD_END = 180
const PULL_LEFT = 168
const PULL_WIDTH = 24
/** The tug when the switch is used without a drag. */
const TUG = 30
const TUG_MS = 120
const TILT_PER_PX = 0.03
const SWING_KICK = 90
const SWAY_KICK = 11
const FADE_MS = 260
const BREATHE_MS = 4200
const RECOIL: Spring = { stiffness: 520, damping: 12, mass: 1 }
const CORD_SWAY: Spring = { stiffness: 140, damping: 5, mass: 1 }
const LAMP_SWAY: Spring = { stiffness: 60, damping: 4, mass: 1 }
/** A bulb catching: two dips, then full. Target and milliseconds. */
const IGNITE = [[0.7, 70], [0.15, 56], [0.85, 112], [0.4, 70], [1, 182]] as const
const SLOP_SIDE = (TARGET - PULL_WIDTH) / 2
const SLOP = { left: SLOP_SIDE, right: SLOP_SIDE, top: 8, bottom: 8 }

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Dust in the light. Fixed values, so every lamp looks the same. */
const MOTES = Array.from({ length: 16 }, (_, i) => ({
  left: 58 + ((i * 37) % 164),
  top: 134 + ((i * 53) % 96),
  size: 2 + (i % 3),
  time: (5 + ((i * 7) % 6)) * 1000,
  phase: (i * 0.13) % 1,
  dx: ((i * 29) % 36) - 18,
  dy: -(18 + ((i * 11) % 26)),
  glow: 0.2 + ((i * 5) % 5) / 20,
}))

export type PullChainLightProps = {
  title?: string
  on?: boolean
  defaultOn?: boolean
  onChange?: (on: boolean) => void
  /** Usually `bulb`, shown beside the title. */
  icon?: ReactNode
  disabled?: boolean
  /** `false` flips the switch without the cord moving. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Mote({ mote, lit, still }: { mote: (typeof MOTES)[number]; lit: boolean; still: boolean }) {
  const styles = useThemed(createStyles)
  const clock = useLoop(lit && !still, mote.time)
  const moteStyle = useAnimatedStyle(() => {
    const at = (clock.value + mote.phase) % 1
    return {
      height: mote.size,
      left: mote.left,
      opacity: !lit ? 0 : still ? 0.25 : interpolate(at, [0, 0.2, 0.8, 1], [0, mote.glow, mote.glow, 0]),
      top: mote.top,
      transform: [
        { translateX: interpolate(at, [0, 0.5, 1], [0, mote.dx * -0.4, mote.dx]) },
        { translateY: interpolate(at, [0, 0.5, 1], [0, mote.dy * 0.5, mote.dy]) },
      ],
      width: mote.size,
    }
  })
  return <Animated.View style={[styles.mote, moteStyle]} />
}

/** A pendant lamp you switch by tugging its pull chain. A tap tugs it too. */
export function PullChainLight({ title = 'Desk lamp', on, defaultOn = false, onChange, icon, disabled, animated = true, style }: PullChainLightProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const off = Boolean(disabled)
  const [held, setHeld] = useState(defaultOn)
  const [pulling, setPulling] = useState(false)
  const lit = on ?? held
  const y = useSharedValue(0)
  const start = useSharedValue(0)
  const swing = useSharedValue(0)
  const sway = useSharedValue(0)
  const glow = useSharedValue(lit ? 1 : 0)
  const breath = useLoop(lit && !still, BREATHE_MS)
  const tilt = useDerivedValue(() => y.value * TILT_PER_PX + sway.value)

  useEffect(() => {
    if (!lit) glow.value = still ? 0 : withTiming(0, { duration: FADE_MS, easing: EASE_OUT_SOFT })
    else if (still) glow.value = 1
    else glow.value = withSequence(...IGNITE.map(([to, duration]) => withTiming(to, { duration })))
  }, [lit, still, glow])

  function flip(): void {
    setHeld(!lit)
    onChange?.(!lit)
  }
  // The pan gesture calls flip through this stable JS thread wrapper, which reads the latest flip
  // (lit, onChange), so the gesture is not rebuilt each time the lamp switches.
  const flipRef = useRef(flip)
  useEffect(() => {
    flipRef.current = flip
  })
  const flipLatest = useCallback((): void => flipRef.current(), [])

  /** The cord snaps back with a bounce, the pull swings and the lamp sways on its wire. */
  const recoil = useCallback((): void => {
    'worklet'
    y.value = withSpring(0, RECOIL)
    swing.value = withSpring(0, { ...CORD_SWAY, velocity: SWING_KICK })
    sway.value = withSpring(0, { ...LAMP_SWAY, velocity: SWAY_KICK })
  }, [y, swing, sway])

  function tug(): void {
    if (still) { flip(); return }
    y.value = withTiming(TUG, { duration: TUG_MS }, (finished) => {
      if (!finished) return
      runOnJS(flip)()
      recoil()
    })
  }

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!still && !off)
    .activeOffsetY([-4, 4])
    .onStart(() => {
      start.value = y.value
      runOnJS(setPulling)(true)
    })
    .onUpdate((event) => {
      const next = start.value + event.translationY
      y.value = next < 0 ? next * ELASTIC : next > REACH ? REACH + (next - REACH) * ELASTIC : next
    })
    .onEnd(() => {
      runOnJS(setPulling)(false)
      if (y.value >= SWITCH_AT) runOnJS(flipLatest)()
      recoil()
    }), [still, off, start, y, flipLatest, recoil])

  const cordProps = useAnimatedProps(() => {
    const end = CORD_END + y.value
    return { d: `M${CORD_X} ${CORD_TOP} Q${CORD_X + swing.value * 0.45} ${CORD_TOP + (end - CORD_TOP) / 2} ${CORD_X + swing.value} ${end}` }
  })
  const lampStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }))
  // The pull hangs off the lamp, so the lamp's tilt carries it sideways too.
  const pullStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: swing.value - (CORD_END + y.value) * Math.sin((tilt.value * Math.PI) / 180) },
      { translateY: y.value },
    ],
  }))
  const lightStyle = useAnimatedStyle(() => {
    const swell = (1 - Math.cos(breath.value * Math.PI * 2)) / 2
    return { opacity: glow.value * (1 - swell * 0.12), transform: [{ scale: 1 + swell * 0.03 }] }
  })
  const undersideStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  const label = lit ? 'Lights on' : 'Lights off'
  const hint = pulling ? 'Release to switch' : lit ? 'Pull again to turn off' : 'Pull the chain, or tap it'

  return (
    <View accessibilityLabel={title} style={[styles.tray, style]}>
      <View style={styles.header}>
        <View style={styles.title}>
          {withInk(icon, colors.textPrimary)}
          <Text numberOfLines={1} style={styles.titleText}>{title}</Text>
        </View>
        <View style={styles.status}>
          {lit ? <View style={styles.statusTint} /> : null}
          <Text style={styles.statusText}>{lit ? 'On' : 'Off'}</Text>
        </View>
      </View>
      <View style={styles.scene}>
        <Animated.View pointerEvents="none" style={[styles.light, lightStyle]}>
          <Svg width={440} height={400}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="46%" rx="50%" ry="50%">
                <Stop offset="0" stopColor={accent.amber.from} stopOpacity={0.5} />
                <Stop offset="0.25" stopColor={accent.amber.from} stopOpacity={0.41} />
                <Stop offset="0.55" stopColor={accent.amber.from} stopOpacity={0.23} />
                <Stop offset="0.8" stopColor={accent.amber.from} stopOpacity={0.07} />
                <Stop offset="1" stopColor={accent.amber.from} stopOpacity={0} />
              </RadialGradient>
              {/* It falls down, so almost none rises above the shade. */}
              <LinearGradient id="fall" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.2" stopColor={accent.onSolid} stopOpacity={0.04} />
                <Stop offset="0.34" stopColor={accent.onSolid} stopOpacity={0.16} />
                <Stop offset="0.45" stopColor={accent.onSolid} stopOpacity={0.58} />
                <Stop offset="0.56" stopColor={accent.onSolid} stopOpacity={1} />
              </LinearGradient>
              <Mask id="below" x="0" y="0" width="440" height="400" maskUnits="userSpaceOnUse">
                <Rect width="440" height="400" fill="url(#fall)" />
              </Mask>
            </Defs>
            <Rect width="440" height="400" fill="url(#glow)" mask="url(#below)" />
          </Svg>
        </Animated.View>
        {MOTES.map((mote) => <Mote key={`${mote.left}-${mote.top}`} mote={mote} lit={lit} still={still} />)}
        <Animated.View pointerEvents="none" style={[styles.lamp, lampStyle]}>
          <Svg width={280} height={232} viewBox="0 0 280 232">
            <Rect x="139" y="0" width="2" height="58" fill={colors.textTertiary} />
            <AnimatedPath animatedProps={cordProps} fill="none" stroke={colors.textTertiary} strokeWidth={2} />
            <Path d="M78 121C84 76 112 56 140 56s56 20 62 65z" fill={lit ? colors.textSecondary : colors.textTertiary} />
            <Path d="M104 88c8-14 20-20 34-22" fill="none" stroke={accent.onSolid} strokeOpacity={0.22} strokeWidth={5} strokeLinecap="round" />
            <Ellipse cx="140" cy="117" rx="50" ry="6" fill={colors.textQuaternary} />
          </Svg>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.lamp, lampStyle, undersideStyle]}>
          <Svg width={280} height={232} viewBox="0 0 280 232">
            <Ellipse cx="140" cy="117" rx="50" ry="6" fill={accent.amber.light} />
          </Svg>
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.pull, off && styles.pullOff, pullStyle]}>
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel={title}
              aria-checked={lit}
              aria-disabled={off}
              disabled={off}
              hitSlop={SLOP}
              style={styles.pullContent}
              onPress={tug}
            >
              <View style={styles.bead} />
              <Svg width={23} height={18} viewBox="0 0 23 18"><Path d="M9 0h5l9 18H0z" fill={colors.inverse} /></Svg>
            </Pressable>
          </Animated.View>
        </GestureDetector>
        <View accessibilityLiveRegion="polite" style={styles.caption}>
          <Text style={styles.captionTitle}>{label}</Text>
          <Text style={styles.meta}>{hint}</Text>
        </View>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: 288, padding: space[1], width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingBottom: space[2.5], paddingHorizontal: space[3], paddingTop: space[2] },
  title: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[2] },
  titleText: type(16, c.textPrimary, '500'),
  status: { backgroundColor: c.ink5, borderRadius: radius.full, overflow: 'hidden', paddingHorizontal: space[2], paddingVertical: space[0.5] },
  statusTint: { ...StyleSheet.absoluteFill, backgroundColor: accent.orange.to, opacity: 0.16 },
  statusText: type(12, c.textSecondary, '500'),
  scene: { alignSelf: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, height: 280, maxWidth: '100%', overflow: 'hidden', width: 280 },
  light: { left: -80, position: 'absolute', top: -60 },
  mote: { backgroundColor: accent.amber.light, borderRadius: radius.full, position: 'absolute' },
  lamp: { left: 0, position: 'absolute', top: 0, transformOrigin: '140px 0px' },
  pull: { left: PULL_LEFT, position: 'absolute', top: CORD_END, width: PULL_WIDTH },
  pullOff: { opacity: 0.4 },
  pullContent: { alignItems: 'center', gap: space[0.5] },
  bead: { backgroundColor: c.inverse, borderRadius: radius.full, height: 8, width: 8 },
  caption: { alignItems: 'center', bottom: space[2.5], gap: space[0.5], left: 0, position: 'absolute', right: 0 },
  captionTitle: type(14, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
})
