import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Path, Pattern, Rect, Stop } from 'react-native-svg'
import { currentState, radius, space, useColors, type Colors } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Spinner } from './spinner'

const FILL_MS = 300
const COLOR_MS = 400
const COMET_MS = 1400
const COMET_SHARE = 0.32
const DONE_MS = 200
const SHAKE_MS = 60
const GLOW_MS = 1200
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const SPREAD = Easing.bezier(0.4, 0, 0.2, 1)
const HEIGHT = { sm: 4, md: 8, lg: 12 } as const

const AnimatedInput = Animated.createAnimatedComponent(TextInput)
const AnimatedPath = Animated.createAnimatedComponent(Path)

const percent = (value: number, max: number): number => Math.min(Math.max((value / max) * 100, 0), 100)
/** The width the value tip is laid out in, centred on the end of the fill. */
const TIP_RAIL = 72
/** A number that counts with the bar, on the UI thread. Mono, so the width holds. */
export function ProgressValue({ value, animated = true, style }: { value: number; animated?: boolean; style?: StyleProp<TextStyle> }) {
  const still = useStill(animated)
  const count = useSharedValue(value)
  useEffect(() => {
    count.value = still ? value : withTiming(value, { duration: FILL_MS, easing: OUT })
  }, [value, still, count])
  const text = useAnimatedProps(() => ({ text: String(Math.round(count.value)), defaultValue: String(Math.round(count.value)) } as TextInputProps))
  // Named with the value it counts to, so a screen reader reads the number and not an empty field.
  return <AnimatedInput editable={false} pointerEvents="none" aria-label={String(Math.round(value))} animatedProps={text} style={style} />
}

export type ProgressProps = {
  /** Leave it out, or set `state="indeterminate"`, when the end is unknown. */
  value?: number
  /** Default 100. */
  max?: number
  /** 4, 8 or 12 points. Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** Worked out from `value` unless set. */
  state?: 'empty' | 'partial' | 'complete' | 'indeterminate' | 'paused' | 'error'
  /** What is progressing. */
  label: string
  /** Overrides the fill, for goal status colours. */
  fillColor?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Shows how far a task has come. */
export function Progress({ value, max = 100, size = 'md', state, label, fillColor, animated = true, style }: ProgressProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const unknown = state === 'indeterminate' || (value === undefined && state === undefined)
  const pct = percent(value ?? 0, max)
  const shown = state ?? (unknown ? 'indeterminate' : pct >= 100 ? 'complete' : pct <= 0 ? 'empty' : 'partial')
  const indeterminate = shown === 'indeterminate'
  const tall = HEIGHT[size]
  const [wide, setWide] = useState(0)

  const ink = fillColor ?? (shown === 'complete' ? colors.success : shown === 'error' ? colors.danger : shown === 'paused' ? colors.textSecondary : colors.textPrimary)
  const fraction = useSharedValue(shown === 'empty' ? 0 : pct / 100)
  const tint = useSharedValue(ink)
  const bump = useSharedValue(1)
  const shake = useSharedValue(0)
  const comet = useSharedValue(0)
  const fade = useSharedValue(1)
  const last = useRef(pct)

  useEffect(() => {
    const target = shown === 'empty' ? 0 : pct / 100
    fraction.value = still || pct < last.current ? target : withTiming(target, { duration: FILL_MS, easing: OUT })
    last.current = pct
  }, [pct, shown, still, fraction])

  useEffect(() => {
    tint.value = still ? ink : withTiming(ink, { duration: COLOR_MS, easing: OUT })
  }, [ink, still, tint])

  useEffect(() => {
    if (still) return
    if (shown === 'complete') bump.value = withSequence(withTiming(1.02, { duration: DONE_MS, easing: OUT }), withTiming(1, { duration: DONE_MS, easing: OUT }))
    if (shown === 'error') shake.value = withSequence(withTiming(-2, { duration: SHAKE_MS }), withTiming(2, { duration: SHAKE_MS * 2 }), withTiming(0, { duration: SHAKE_MS }))
  }, [shown, still, bump, shake])

  useEffect(() => {
    if (!indeterminate || !animated) return undefined
    if (still) fade.value = withRepeat(withSequence(withTiming(0.4, { duration: 800, easing: Easing.linear }), withTiming(1, { duration: 800, easing: Easing.linear })), -1)
    else comet.value = withRepeat(withTiming(1, { duration: COMET_MS, easing: SPREAD }), -1, false)
    return () => {
      cancelAnimation(comet)
      cancelAnimation(fade)
      comet.value = 0
      fade.value = 1
    }
  }, [indeterminate, animated, still, comet, fade])

  const moving = !still
  const span = wide * COMET_SHARE
  const trackMotion = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }, { scale: bump.value }] }))
  const fillMotion = useAnimatedStyle(() => ({ backgroundColor: tint.value, transform: [{ translateX: Math.max(tall, wide * fraction.value) - wide }] }))
  const cometMotion = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ translateX: moving ? span * (comet.value * 4.125 - 1) : wide - span }] }))

  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      {...(unknown ? { 'aria-valuemin': 0, 'aria-valuemax': max } : { 'aria-valuemin': 0, 'aria-valuemax': max, 'aria-valuenow': value ?? 0 })}
      onLayout={(e) => setWide(e.nativeEvent.layout.width)}
      style={[styles.track, styles[size], trackMotion, style]}
    >
      {indeterminate ? (
        <Animated.View style={[styles.comet, cometMotion]}>
          <Svg aria-hidden width={span} height="100%">
            <Defs>
              <LinearGradient id="comet" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.textPrimary} stopOpacity={0} />
                <Stop offset="1" stopColor={colors.textPrimary} />
              </LinearGradient>
            </Defs>
            <Rect width={span} height="100%" fill="url(#comet)" />
          </Svg>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.fill, fillMotion]}>
          {shown === 'paused' ? (
            <Svg aria-hidden width="100%" height="100%">
              <Defs>
                <Pattern id="stripes" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(25)">
                  <Rect width={2} height={8} fill={colors.surface} />
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#stripes)" />
            </Svg>
          ) : null}
        </Animated.View>
      )}
    </Animated.View>
  )
}

function Shell({ children, footer, style }: { children: ReactNode; footer?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemed(makeStyles)
  return (
    <View style={[styles.shell, style]}>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  )
}

type Recipe = { value: number; animated?: boolean }

/** A title and a counting percent over the bar, with an optional action and hint below. */
export function ProgressLabel({ title, value, action, hint, renderIcon, animated = true }: Recipe & { title: string; action?: ReactNode; hint?: string; renderIcon?: RenderIcon }) {
  const styles = useThemed(makeStyles)
  return (
    <Shell footer={action || hint ? <>{action}{hint ? <View style={styles.hintRow}>{renderIcon?.('lock', 14)}<Text style={styles.hint}>{hint}</Text></View> : null}</> : undefined}>
      <View style={styles.row}>
        <Text style={styles.name}>{title}</Text>
        <View style={styles.inline}><ProgressValue value={value} animated={animated} style={styles.mono} /><Text style={styles.mono}>%</Text></View>
      </View>
      <Progress value={value} label={title} animated={animated} />
    </Shell>
  )
}

/** A percent tip that rides above the fill. */
export function ProgressTip({ title, value, animated = true }: Recipe & { title: string }) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [wide, setWide] = useState(0)
  const at = useSharedValue(value)
  useEffect(() => {
    at.value = still ? value : withTiming(value, { duration: FILL_MS, easing: OUT })
  }, [value, still, at])
  const rail = useAnimatedStyle(() => ({ transform: [{ translateX: (wide * at.value) / 100 }] }))
  return (
    <Shell>
      <Text style={styles.muted}>{title}</Text>
      <View style={styles.tipBar} onLayout={(e) => setWide(e.nativeEvent.layout.width)}>
        <Animated.View pointerEvents="none" style={[styles.rail, rail]}>
          <View style={styles.tip}>
            <ProgressValue value={value} animated={animated} style={styles.tipText} />
            <Text style={styles.tipText}>%</Text>
          </View>
        </Animated.View>
        <Progress value={value} label={title} animated={animated} />
      </View>
    </Shell>
  )
}

export type ProgressStage = { label: string; value: number }

/** Named stages, each with its own short bar. */
export function ProgressSegments({ stages, animated = true }: { stages: ProgressStage[]; animated?: boolean }) {
  const styles = useThemed(makeStyles)
  return (
    <Shell>
      <View style={styles.segments}>
        {stages.map(({ label, value }) => {
          const reached = value > 0
          return (
            <View key={label} style={styles.segment}>
              <Text style={[styles.segmentLabel, reached ? styles.reachedText : null]}>{label}</Text>
              <View style={[styles.segmentDot, reached ? styles.reachedDot : null]} />
              <Progress size="sm" value={value} label={label} {...(value >= 100 ? { state: 'partial' as const } : {})} animated={animated} />
            </View>
          )
        })}
      </View>
    </Shell>
  )
}

/** Numbered steps, joined by a line. */
export function ProgressSteps({ steps, current, renderIcon }: { steps: string[]; current: number; renderIcon: RenderIcon }) {
  const styles = useThemed(makeStyles)
  return (
    <Shell>
      <View style={styles.steps}>
        {steps.map((step, i) => {
          const status = i < current ? 'done' : i === current ? 'current' : 'next'
          return (
            <View key={step} style={styles.step} accessible accessibilityLabel={step} {...currentState(i === current, 'step')}>
              {i > 0 ? <View style={[styles.stepLine, status === 'next' ? styles.stepLineNext : null]} /> : null}
              <View style={[styles.stepMark, status === 'current' ? styles.stepCurrent : null, status === 'next' ? styles.stepNext : null]}>
                {status === 'done' ? renderIcon('check', 12) : null}
                {status === 'current' ? <View style={styles.stepDot} /> : null}
              </View>
              <Text style={[styles.stepLabel, status === 'next' ? styles.stepLabelNext : null]}>{step}</Text>
            </View>
          )
        })}
      </View>
    </Shell>
  )
}

/** A bar with the time left beneath it. */
export function ProgressEta({ title, value, left, renderIcon, animated = true }: Recipe & { title: string; left: string; renderIcon: RenderIcon }) {
  const styles = useThemed(makeStyles)
  return (
    <Shell>
      <View style={styles.row}>
        <Text style={styles.name}>{title}</Text>
        <View style={styles.inline}><ProgressValue value={value} animated={animated} style={styles.mono} /><Text style={styles.mono}>%</Text></View>
      </View>
      <Progress value={value} label={title} animated={animated} />
      <View style={styles.hintRow}>{renderIcon('clock', 14)}<Text style={styles.hint}>{left}</Text></View>
    </Shell>
  )
}

/** A big number and a bar with a breathing knob. */
export function ProgressUpload({ title, value, animated = true }: Recipe & { title: string }) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const done = value >= 100
  const [wide, setWide] = useState(0)
  const at = useSharedValue(value)
  const glow = useSharedValue(0.12)
  useEffect(() => {
    at.value = still ? value : withTiming(value, { duration: FILL_MS, easing: OUT })
  }, [value, still, at])
  useEffect(() => {
    if (done || still) {
      cancelAnimation(glow)
      glow.value = done ? 0 : 0.12
      return undefined
    }
    glow.value = 0.08
    glow.value = withRepeat(withTiming(0.16, { duration: GLOW_MS, easing: SPREAD }), -1, true)
    return () => cancelAnimation(glow)
  }, [done, still, glow])
  const rail = useAnimatedStyle(() => ({ transform: [{ translateX: (wide * at.value) / 100 }] }))
  const halo = useAnimatedStyle(() => ({ opacity: glow.value }))
  return (
    <Shell>
      <View style={styles.row}>
        <View style={styles.hintRow}><Spinner kind="dots" size="s" label={null} animated={animated} color={colors.textTertiary} /><Text style={styles.hint}>{title}</Text></View>
        <View style={styles.bigRow}><ProgressValue value={value} animated={animated} style={styles.big} /><Text style={styles.bigUnit}>%</Text></View>
      </View>
      <View onLayout={(e) => setWide(e.nativeEvent.layout.width)}>
        <Progress size="sm" value={value} {...(done ? { state: 'partial' as const } : {})} label={title} animated={animated} />
        <Animated.View pointerEvents="none" style={[styles.knobRail, rail]}>
          <Animated.View style={[styles.knobGlow, halo]} />
          <View style={styles.knob} />
        </Animated.View>
      </View>
    </Shell>
  )
}

/** Chunks fill in order, with the percent above. */
export function ProgressDownload({ value, chunks = 12, renderIcon, animated = true }: Recipe & { chunks?: number; renderIcon: RenderIcon }) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [wide, setWide] = useState(0)
  const fraction = useSharedValue(value / 100)
  useEffect(() => {
    fraction.value = still ? value / 100 : withTiming(value / 100, { duration: FILL_MS, easing: OUT })
  }, [value, still, fraction])
  const fill = useAnimatedStyle(() => ({ transform: [{ translateX: wide * (fraction.value - 1) }] }))
  return (
    <Shell>
      <View style={styles.hintRow}>{renderIcon('download', 16)}<Text style={styles.hint}><Text style={styles.strong}>Download</Text> in progress</Text></View>
      <Text style={styles.hint}><Text style={styles.strong}>{Math.round(value)}%</Text> complete</Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Download"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        onLayout={(e) => setWide(e.nativeEvent.layout.width)}
        style={styles.chunks}
      >
        <Animated.View style={[styles.chunkFill, fill]}>
          {Array.from({ length: chunks - 1 }, (_, i) => <View key={i} style={styles.chunkGap} />)}
        </Animated.View>
      </View>
    </Shell>
  )
}

/** A figure, a delta and a row of ticks. */
export function ProgressTicks({ title, description, value, delta, compared, ticks = 66, renderIcon, onMore }: { title: string; description: string; value: number; delta: string; compared: string; ticks?: number; renderIcon: RenderIcon; onMore?: () => void }) {
  const styles = useThemed(makeStyles)
  const lit = Math.round((value / 100) * ticks)
  return (
    <Shell>
      <View style={styles.row}>
        <View style={styles.titles}><Text style={styles.name}>{title}</Text><Text style={styles.small}>{description}</Text></View>
        {onMore ? <IconButton variant="ghost" size="sm" icon={renderIcon('more-horizontal', 16)} label="More" onPress={onMore} /> : null}
      </View>
      <View style={styles.delta}>
        <Text style={styles.name}>{value}%</Text>
        <Text style={styles.pill}>↗ {delta}</Text>
        <Text style={styles.small}>{compared}</Text>
      </View>
      <View accessible accessibilityRole="progressbar" accessibilityLabel={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} style={styles.ticks}>
        {Array.from({ length: ticks }, (_, i) => <View key={i} style={[styles.tick, i < lit ? styles.tickLit : null]} />)}
      </View>
    </Shell>
  )
}

export type ProgressFlightProps = {
  value: number
  from: { code: string; city: string; time: string }
  to: { code: string; city: string; time: string }
  status: string
  flight: string
  left: string
  renderIcon: RenderIcon
  animated?: boolean
}

const ARC = 'M6 44 C 90 4, 210 4, 294 44'
const ARC_WIDTH = 300
const ARC_HEIGHT = 52
const P = [[6, 44], [90, 4], [210, 4], [294, 44]] as const
const PLANE = 18

/** The arc's point and heading at `t`, from its Bézier controls. RN has no getPointAtLength. */
function pointOnArc(t: number): { x: number; y: number; angle: number } {
  'worklet'
  const u = 1 - t
  const [a, b, c, d] = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
  const x = a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0]
  const y = a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]
  const dx = 3 * u * u * (P[1][0] - P[0][0]) + 6 * u * t * (P[2][0] - P[1][0]) + 3 * t * t * (P[3][0] - P[2][0])
  const dy = 3 * u * u * (P[1][1] - P[0][1]) + 6 * u * t * (P[2][1] - P[1][1]) + 3 * t * t * (P[3][1] - P[2][1])
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI }
}

const ARC_LENGTH = Array.from({ length: 100 }, (_, i) => {
  const a = pointOnArc(i / 100)
  const b = pointOnArc((i + 1) / 100)
  return Math.hypot(b.x - a.x, b.y - a.y)
}).reduce((sum, step) => sum + step, 0)

/** A plane on the line. Its position comes from the real curve. */
export function ProgressFlight({ value, from, to, status, flight, left, renderIcon, animated = true }: ProgressFlightProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [wide, setWide] = useState(0)
  const at = useSharedValue(value / 100)
  useEffect(() => {
    at.value = still ? value / 100 : withTiming(value / 100, { duration: FILL_MS, easing: Easing.linear })
  }, [value, still, at])
  const scale = wide / ARC_WIDTH
  const trail = useAnimatedProps(() => ({ strokeDashoffset: ARC_LENGTH * (1 - at.value) }))
  const point = useDerivedValue(() => pointOnArc(at.value))
  const plane = useAnimatedStyle(() => ({
    transform: [{ translateX: point.value.x * scale - PLANE / 2 }, { translateY: point.value.y * scale - PLANE / 2 }, { rotate: `${point.value.angle + 90}deg` }],
  }))
  return (
    <Shell footer={<><Text style={styles.flight}>{flight}</Text><Text style={styles.small}>{left}</Text></>}>
      <View style={styles.row}>
        <Text style={styles.flight}>DEPARTURE {from.time}</Text>
        <Text style={styles.flight}>ARRIVAL {to.time}</Text>
      </View>
      <View style={styles.route}>
        <View><Text style={styles.code}>{from.code}</Text><Text style={styles.small}>{from.city}</Text></View>
        <View style={styles.arc} onLayout={(e) => setWide(e.nativeEvent.layout.width)}>
          <Svg aria-hidden width="100%" height="100%" viewBox={`0 0 ${ARC_WIDTH} ${ARC_HEIGHT}`} fill="none">
            <Path d={ARC} stroke={colors.textPrimary} strokeOpacity={0.2} strokeDasharray={[2, 4]} />
            <AnimatedPath animatedProps={trail} d={ARC} stroke={colors.textPrimary} strokeWidth={1.5} strokeDasharray={[ARC_LENGTH, ARC_LENGTH]} />
          </Svg>
          <Animated.View style={[styles.plane, plane]}>{renderIcon('navigation', PLANE)}</Animated.View>
        </View>
        <View style={styles.routeEnd}><Text style={styles.code}>{to.code}</Text><Text style={styles.small}>{to.city}</Text></View>
      </View>
      <View style={styles.chip}><View style={styles.chipDot} /><Text style={styles.chipText}>{status}</Text></View>
    </Shell>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  track: { width: '100%', overflow: 'hidden', borderRadius: radius.full, backgroundColor: c.ink8 },
  sm: { height: HEIGHT.sm },
  md: { height: HEIGHT.md },
  lg: { height: HEIGHT.lg },
  fill: { ...StyleSheet.absoluteFill, overflow: 'hidden', borderRadius: radius.full },
  comet: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  shell: { width: '100%', maxWidth: 366, padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  body: { gap: space[3], paddingVertical: space[4], paddingHorizontal: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingTop: space[2], paddingHorizontal: space[3], paddingBottom: space[1.5] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  inline: { flexDirection: 'row', alignItems: 'center' },
  titles: { flex: 1, minWidth: 0 },
  name: type(14, c.textPrimary, '500'),
  muted: { ...type(14, c.textSecondary), lineHeight: 18 },
  mono: { ...type(12, c.textSecondary, '400', true), padding: 0 },
  small: type(12, c.textSecondary),
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  hint: type(12, c.textTertiary),
  strong: { fontWeight: '500', color: c.textPrimary },
  tipBar: { paddingTop: space[7] },
  // A zero-wide rail squeezed the tip to its padding on iOS; a fixed width centred on the fill's end leaves it room.
  rail: { position: 'absolute', top: 0, left: -TIP_RAIL / 2, width: TIP_RAIL, alignItems: 'center' },
  tip: { flexDirection: 'row', paddingVertical: space[1], paddingHorizontal: space[2], borderRadius: radius.lg, backgroundColor: c.inverse },
  tipText: { ...type(11, c.textInverse, '400', true), padding: 0 },
  segments: { flexDirection: 'row', gap: space[1.5] },
  segment: { flex: 1, alignItems: 'center', gap: space[1.5] },
  segmentLabel: type(12, c.textTertiary, '500'),
  reachedText: { color: c.textPrimary },
  segmentDot: { width: 4, height: 4, borderRadius: radius.full, backgroundColor: c.ink10 },
  reachedDot: { backgroundColor: c.textPrimary },
  steps: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { flex: 1, alignItems: 'center', gap: space[1.5] },
  stepLine: { position: 'absolute', top: 11, right: '50%', left: '-50%', marginHorizontal: 18, height: 2, backgroundColor: c.textPrimary },
  stepLineNext: { backgroundColor: c.ink8 },
  stepMark: { alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: radius.full, backgroundColor: c.inverse },
  stepCurrent: { borderWidth: 2, borderColor: c.textPrimary, backgroundColor: c.surface },
  stepNext: { backgroundColor: c.ink8 },
  stepDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: c.textPrimary },
  stepLabel: type(12, c.textPrimary, '500'),
  stepLabelNext: { color: c.textTertiary },
  bigRow: { flexDirection: 'row', alignItems: 'baseline' },
  big: { ...type(28, c.textPrimary, '500', true), lineHeight: 32, padding: 0 },
  bigUnit: { ...type(12, c.textTertiary, '400', true), marginLeft: space[0.5] },
  knobRail: { position: 'absolute', top: 2, left: 0, width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  knobGlow: { position: 'absolute', width: 28, height: 28, borderRadius: radius.full, backgroundColor: c.textPrimary },
  knob: { width: 12, height: 12, borderRadius: radius.full, borderWidth: 2, borderColor: c.textPrimary, backgroundColor: c.surface },
  chunks: { height: 24, overflow: 'hidden', borderRadius: radius.md, backgroundColor: c.ink5 },
  chunkFill: { flex: 1, flexDirection: 'row', justifyContent: 'space-evenly', backgroundColor: c.textPrimary },
  chunkGap: { width: 1, height: '100%', backgroundColor: c.surface },
  delta: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  pill: { ...type(12, c.success, '500'), paddingVertical: space[0.5], paddingHorizontal: space[1.5], borderRadius: radius.full, overflow: 'hidden', backgroundColor: c.ink5 },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', height: 32, overflow: 'hidden' },
  tick: { width: 3, backgroundColor: c.ink10 },
  tickLit: { backgroundColor: c.textPrimary },
  flight: type(11, c.textTertiary, '400', true),
  route: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  routeEnd: { alignItems: 'flex-end' },
  code: { ...type(18, c.textPrimary, '600'), lineHeight: 22 },
  arc: { flex: 1, minWidth: 0, aspectRatio: ARC_WIDTH / ARC_HEIGHT },
  plane: { position: 'absolute', top: 0, left: 0 },
  chip: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: space[1], paddingVertical: space[0.5], paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: c.ink5 },
  chipDot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: c.success },
  chipText: type(12, c.success, '500'),
})
