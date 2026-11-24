import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeOut, ZoomIn, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import Svg, { Line, Path } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { iconFor } from './label'

const WIDE = 3.6
const THIN = 1.1
const WIDTH_EASE = 0.08
const SPEED_FOR_THIN = 2.4
const CLEAR_MS = 420
const FOLLOW = 0.55
const SHAKE_MS = 240
const FADE_MS = 200
const STAMP = { stiffness: 500, damping: 22, mass: 1 } as const

const AnimatedPath = Animated.createAnimatedComponent(Path)
const stampIn = ZoomIn.springify().stiffness(STAMP.stiffness).damping(STAMP.damping).mass(STAMP.mass).withInitialValues({ transform: [{ scale: 0.6 }] })

/** Turns x, y, width triples into a closed shape, because an SVG stroke cannot change width. */
function outline(points: number[]): string {
  'worklet'
  const count = Math.floor(points.length / 3)
  if (count === 0) return ''
  const x0 = points[0] ?? 0
  const y0 = points[1] ?? 0
  if (count === 1) {
    const r = (points[2] ?? WIDE) / 2
    return `M${x0 - r} ${y0}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`
  }
  let left = ''
  let right = ''
  for (let i = 0; i < count; i++) {
    const before = Math.max(0, i - 1) * 3
    const after = Math.min(count - 1, i + 1) * 3
    const dx = (points[after] ?? 0) - (points[before] ?? 0)
    const dy = (points[after + 1] ?? 0) - (points[before + 1] ?? 0)
    const length = Math.hypot(dx, dy) || 1
    const half = (points[i * 3 + 2] ?? WIDE) / 2
    const nx = (-dy / length) * half
    const ny = (dx / length) * half
    const x = points[i * 3] ?? 0
    const y = points[i * 3 + 1] ?? 0
    left += `${i === 0 ? 'M' : 'L'}${(x + nx).toFixed(1)} ${(y + ny).toFixed(1)}`
    right = `L${(x - nx).toFixed(1)} ${(y - ny).toFixed(1)}${right}`
  }
  return `${left}${right}Z`
}

export type SignaturePadProps = {
  /** What is being signed, in the header. */
  title?: string
  /** Fires with a PNG data URL, or null when cleared. */
  onChange?: (signature: string | null) => void
  /** Fires when the signature is confirmed. */
  onConfirm?: (signature: string) => void
  /** Rings the pad and says why, when someone tries to continue. */
  required?: boolean
  disabled?: boolean
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A surface to sign on. Ink is smoothed and thins with speed; everything around it stays still. */
export function SignaturePad({ title = 'Sign to accept', onChange, onConfirm, required, disabled = false, renderIcon, animated = true, style }: SignaturePadProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const canvas = useRef<Svg>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const live = useSharedValue<number[]>([])
  const tip = useSharedValue({ x: 0, y: 0, width: WIDE })
  const x = useSharedValue(0)
  const inkFade = useSharedValue(1)
  const [strokes, setStrokes] = useState<string[]>([])
  const [signing, setSigning] = useState(false)
  const [signedAt, setSignedAt] = useState<Date | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [frame, setFrame] = useState({ width: 0, height: 200 })
  const signed = strokes.length > 0
  const locked = confirmed || disabled

  useEffect(() => () => clearTimeout(timer.current), [])

  const liveProps = useAnimatedProps(() => ({ d: outline(live.value) }))
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const fade = useAnimatedStyle(() => ({ opacity: inkFade.value }))

  /** Reads the drawing back from native, so PNG export waits for the new strokes to paint. */
  function capture(done: (image: string) => void): void {
    requestAnimationFrame(() => canvas.current?.toDataURL((base64) => done(`data:image/png;base64,${base64}`)))
  }

  function emit(next: string[]): void {
    setStrokes(next)
    if (next.length) setSignedAt(new Date())
    if (!onChange) return
    if (next.length) capture(onChange)
    else onChange(null)
  }

  function finish(points: number[]): void {
    emit([...strokes, outline(points)])
    setSigning(false)
    requestAnimationFrame(() => { live.value = [] })
  }

  const pan = Gesture.Pan()
    .enabled(!locked)
    .minDistance(0)
    .maxPointers(1)
    .onBegin((e) => {
      tip.value = { x: e.x, y: e.y, width: WIDE }
      live.value = [e.x, e.y, WIDE]
      runOnJS(setSigning)(true)
    })
    .onUpdate((e) => {
      const from = tip.value
      const nextX = from.x + (e.x - from.x) * FOLLOW
      const nextY = from.y + (e.y - from.y) * FOLLOW
      const speed = Math.hypot(nextX - from.x, nextY - from.y)
      const goal = Math.max(THIN, WIDE - (speed / SPEED_FOR_THIN) * (WIDE - THIN) * 0.25)
      const width = from.width + (goal - from.width) * WIDTH_EASE
      tip.value = { x: nextX, y: nextY, width }
      live.modify((points) => {
        'worklet'
        points.push(nextX, nextY, width)
        return points
      })
    })
    .onFinalize(() => {
      if (live.value.length) runOnJS(finish)(live.value)
    })

  function undo(): void {
    emit(strokes.slice(0, -1))
  }

  function clear(): void {
    if (still) { emit([]); return }
    inkFade.value = withTiming(0, { duration: CLEAR_MS })
    timer.current = setTimeout(() => { emit([]); inkFade.value = 1 }, CLEAR_MS)
  }

  function confirm(): void {
    if (!signed) {
      if (!still) {
        const leg = { duration: SHAKE_MS / 3 }
        x.value = withSequence(withTiming(2, leg), withTiming(-2, leg), withTiming(0, leg))
      }
      return
    }
    setConfirmed(true)
    if (onConfirm) capture(onConfirm)
  }

  const time = signedAt ? signedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null
  const hintGone = signed || signing

  return (
    <View style={[styles.tray, disabled && styles.disabled, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.time}>{confirmed ? 'Confirmed' : signed ? `Signed ${time ?? ''}` : ''}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View
          accessibilityHint="Draw with a finger or pen."
          accessibilityLabel="Signature canvas"
          collapsable={false}
          style={[styles.card, required && !signed && styles.cardRequired, shake]}
          onLayout={(e: LayoutChangeEvent) => setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        >
          <View style={styles.baseline}>
            <Svg width={Math.max(0, frame.width - space[5] * 2)} height={1}>
              <Line x1={0} x2={Math.max(0, frame.width - space[5] * 2)} y1={0.5} y2={0.5} stroke={colors.ink10} strokeWidth={1} strokeDasharray={[1, 2]} />
            </Svg>
            <Text style={styles.cross}>×</Text>
          </View>
          {hintGone ? null : <Animated.Text {...(still ? {} : { entering: FadeIn.duration(FADE_MS), exiting: FadeOut.duration(FADE_MS) })} style={styles.hint}>Sign here</Animated.Text>}
          <Animated.View style={[StyleSheet.absoluteFill, fade]}>
            <Svg ref={canvas} width={frame.width} height={frame.height}>
              {strokes.map((d, i) => <Path key={i} d={d} fill={colors.textPrimary} />)}
              <AnimatedPath animatedProps={liveProps} fill={colors.textPrimary} />
            </Svg>
          </Animated.View>
          {confirmed ? (
            <Animated.View {...(still ? {} : { entering: stampIn })} style={styles.stamp}>
              {iconFor(renderIcon, 'tick-02', 14, colors.success)}
              <Text style={styles.stampText}>Signed</Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </GestureDetector>
      <View style={styles.footer}>
        {required && !signed ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>A signature is required</Text> : null}
        {confirmed ? (
          <Button variant="ghost" size="sm" animated={animated} onPress={() => setConfirmed(false)}>Edit</Button>
        ) : (
          <>
            <Button variant="ghost" size="sm" animated={animated} disabled={!signed || disabled} leadingIcon={iconFor(renderIcon, 'undo', 16, colors.textPrimary)} onPress={undo}>Undo</Button>
            <Button variant="secondary" size="sm" animated={animated} disabled={!signed || disabled} onPress={clear}>Clear</Button>
            <Button size="sm" animated={animated} disabled={disabled} onPress={confirm}>Confirm</Button>
          </>
        )}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.frame, padding: space[1], width: '100%' },
  disabled: { opacity: 0.5 },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingHorizontal: space[3], paddingVertical: space[2] },
  title: type(16, c.textPrimary, '500'),
  time: type(10, c.textTertiary, '400', true),
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, height: 200, overflow: 'hidden' },
  cardRequired: { borderColor: c.danger, borderWidth: 1.5 },
  hint: { ...type(14, c.textTertiary), bottom: 52, left: 40, position: 'absolute' },
  // iOS draws no dotted border on a single side, so the dotted rule is an Svg line.
  baseline: { bottom: 44, left: space[5], position: 'absolute', right: space[5] },
  cross: { ...type(14, c.textTertiary), bottom: space[0.5], left: 0, position: 'absolute' },
  stamp: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', gap: space[1], paddingHorizontal: space[2], paddingVertical: space[0.5], position: 'absolute', right: space[3], top: space[3] },
  stampText: type(12, c.success, '500'),
  footer: { alignItems: 'center', flexDirection: 'row', gap: space[1], justifyContent: 'flex-end', padding: space[2] },
  error: { ...type(12, c.danger), flex: 1 },
})
