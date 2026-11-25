import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState, StyleSheet, View, useColorScheme, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Rect } from 'react-native-svg'
import { accent, radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT } from './button'
import { useStill } from './card'

/*
 * What differs from web: the web ring is a WebGL shader (light and dark bands drifting round a 1.5 px band, a bright
 * outer lip, a swell toward a mouse pointer). Here the same band is a stroked rounded rect in react-native-svg: three
 * soft light bands, built from stacked dashes, drift round the edge on the UI thread, and seven fainter glints drift
 * the other way, which is what the shader's two sine waves draw. The pointer swell (`bend`) is left out: touch never
 * bends the web ring either, and phones have no hover pointer. `theme` is left out because kit.ts only exposes the
 * system palette. The bands follow the perimeter, where the shader follows the angle round the centre.
 */

/** One drift turn at speed 1: the shader's 0.12 turns a second. */
const TURN_MS = 1000 / 0.12
/** Strength eases in about 240 ms, as the web's per frame lerp. */
const STRENGTH_MS = 240
/** Bands drift this many times faster while a request is in flight. */
const THINKING_SPEED = 2.5
/** The thinking glow breathes between 60% and full over 2.4 s. */
const BREATHE_MS = 2400
const IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
/** Three light bands round the edge, each built from three dashes so its edges fall off softly. */
const BANDS = 3
const BAND_DASHES = [{ share: 0.5, opacity: 0.4 }, { share: 0.3, opacity: 0.45 }, { share: 0.14, opacity: 0.6 }] as const
/** Seven glints drift the other way at 5/7 the pace, so a whole turn lands them where they started. */
const GLINTS = 7
const GLINT_PACE = -5 / 7

const AnimatedRect = Animated.createAnimatedComponent(Rect)

/** True while the app is in the foreground. Loops hold where they are in the background. */
export function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background')
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => setActive(next === 'active'))
    return () => sub.remove()
  }, [])
  return active
}

/**
 * A linear clock in turns on the UI thread, one turn every `periodMs` while `running`. Stopping holds the clock where
 * it is, or returns it to 0 when `rest` is set. A new period picks up from the current turn, so nothing jumps.
 */
export function useTurn(running: boolean, periodMs: number, rest: boolean): SharedValue<number> {
  const turn = useSharedValue(0)
  useEffect(() => {
    if (!running) {
      cancelAnimation(turn)
      if (rest) turn.value = 0
      return undefined
    }
    const from = turn.value
    turn.value = withRepeat(withTiming(from + 1, { duration: periodMs, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(turn)
  }, [running, periodMs, rest, turn])
  return turn
}

export type RingShape = { x: number; y: number; width: number; height: number; rx: number; length: number }

/** The stroke's centre line: the box inset by `inset`, its corner clamped to the box, and its length. */
export function ringShape(w: number, h: number, corner: number, inset: number): RingShape {
  const width = Math.max(0, w - inset * 2)
  const height = Math.max(0, h - inset * 2)
  const rx = Math.max(0, Math.min(corner - inset, width / 2, height / 2))
  return { x: inset, y: inset, width, height, rx, length: 2 * (width + height) - 8 * rx + 2 * Math.PI * rx }
}

export type RingDashProps = {
  shape: RingShape
  turn: SharedValue<number>
  /** Pattern length in px; the shape's length over a whole number keeps a turn seamless. */
  period: number
  /** The dash, as a share of the period. */
  share: number
  /** Turns of the pattern per clock turn. Negative runs the other way. */
  pace: number
  /** Where the dash's centre sits at turn 0, as a share of the shape's length. Default 0. */
  phase?: number
  color: string
  opacity: number
  strokeWidth: number
}

/** One dash pattern round a rounded rect, moved along it by the clock. */
export function RingDash({ shape, turn, period, share, pace, phase = 0, color, opacity, strokeWidth }: RingDashProps) {
  const dash = period * share
  const props = useAnimatedProps(() => ({ strokeDashoffset: dash / 2 - (phase + (turn.value % 1) * pace) * shape.length }))
  return (
    <AnimatedRect
      x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} ry={shape.rx}
      fill="none" stroke={color} strokeOpacity={opacity} strokeWidth={strokeWidth}
      strokeDasharray={[dash, period - dash]} animatedProps={props}
    />
  )
}

export type MetalRingTint = 'chrome' | 'sky'

export type MetalRingProps = {
  /** Corner radius in px. Default 18, the card radius. React Native cannot read the parent's radius, so pass it. */
  borderRadius?: number | undefined
  /** Band width in px. Default 1.5. */
  ringCssPx?: number | undefined
  /** How bright and solid the metal is, 0 to 1. Changes ease in. Default 1. */
  strength?: number | undefined
  /** Drift multiplier. 1 is the rest drift; thinking runs faster. Default 1. */
  speed?: number | undefined
  /** Holds the bands where they are. */
  paused?: boolean | undefined
  /** Chrome, or chrome washed in the sky tokens. Default `chrome`. */
  tint?: MetalRingTint | undefined
  /** Greys the metal, for a disabled field. */
  disabled?: boolean | undefined
  /** Draws the ring with its bands held at rest. */
  still?: boolean | undefined
  style?: StyleProp<ViewStyle> | undefined
}

type Palette = { lo: string; hi: string; glint: string; glintOpacity: number }

function palette(c: Colors, dark: boolean, tint: MetalRingTint, disabled: boolean): Palette {
  if (disabled) return { lo: c.ink10, hi: c.ink5, glint: c.ink5, glintOpacity: 0 }
  if (tint === 'sky') return { lo: accent.sky.deep, hi: accent.sky.from, glint: accent.onSolid, glintOpacity: 0.45 }
  return dark
    ? { lo: c.muted, hi: c.textPrimary, glint: accent.onSolid, glintOpacity: 0.3 }
    : { lo: c.textTertiary, hi: c.surface, glint: accent.onSolid, glintOpacity: 0.5 }
}

/** Placed over its parent's edge. Decorative, so it is hidden from assistive tech and never takes a touch. */
export function MetalRing({ borderRadius = radius.card, ringCssPx = 1.5, strength = 1, speed = 1, paused = false, tint = 'chrome', disabled = false, still = false, style }: MetalRingProps) {
  const colors = useColors()
  const dark = useColorScheme() === 'dark'
  const active = useAppActive()
  const [box, setBox] = useState({ w: 0, h: 0 })
  const turn = useTurn(!still && !paused && active && box.w > 0, TURN_MS / Math.max(0.1, speed), still)
  const alpha = useSharedValue(-1)
  const target = (0.5 + 0.42 * Math.max(0, Math.min(1, strength))) * (dark ? 1 : 0.85)

  useEffect(() => {
    alpha.value = still || alpha.value < 0 ? target : withTiming(target, { duration: STRENGTH_MS, easing: EASE_OUT })
  }, [target, still, alpha])

  const alphaStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, alpha.value) }))

  function measure(event: LayoutChangeEvent): void {
    const { width, height } = event.nativeEvent.layout
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
  }

  const ink = palette(colors, dark, tint, disabled)
  const corner = Math.min(borderRadius, box.w / 2, box.h / 2)
  const band = ringShape(box.w, box.h, corner, ringCssPx / 2)
  const lip = ringShape(box.w, box.h, corner, 0.25)
  const ready = box.w > 0 && box.h > 0

  return (
    <Animated.View aria-hidden pointerEvents="none" onLayout={measure} style={[StyleSheet.absoluteFill, alphaStyle, style]}>
      {ready ? (
        <Svg aria-hidden width={box.w} height={box.h}>
          <Rect x={band.x} y={band.y} width={band.width} height={band.height} rx={band.rx} ry={band.rx} fill="none" stroke={ink.lo} strokeWidth={ringCssPx} />
          {BAND_DASHES.map((dash) => (
            <RingDash key={dash.share} shape={band} turn={turn} period={band.length / BANDS} share={dash.share} pace={1} color={ink.hi} opacity={dash.opacity} strokeWidth={ringCssPx} />
          ))}
          {ink.glintOpacity > 0 ? <RingDash shape={band} turn={turn} period={band.length / GLINTS} share={0.24} pace={GLINT_PACE} color={ink.glint} opacity={ink.glintOpacity} strokeWidth={ringCssPx} /> : null}
          {/* The bright lip on the outer edge. */}
          <Rect x={lip.x} y={lip.y} width={lip.width} height={lip.height} rx={lip.rx} ry={lip.rx} fill="none" stroke={ink.glint} strokeOpacity={ink.glintOpacity * 0.6} strokeWidth={0.5} />
        </Svg>
      ) : null}
    </Animated.View>
  )
}

export type MetalFrameProps = {
  children: ReactNode
  /** Box wraps a surface, Pill a field, Circle an avatar. Default `box`. */
  shape?: 'box' | 'pill' | 'circle'
  /** The request is in flight. The bands run faster and a soft ink glow breathes. */
  thinking?: boolean
  disabled?: boolean
  animated?: boolean
  /** How bright and solid the metal is, 0 to 1. Default 1. */
  strength?: number
  /** The ring's width in px. Default 1.5. */
  ringCssPx?: number
  /** Corner radius in px. Left out, the shape's token radius is used. */
  borderRadius?: number
  /** Holds the reflections still. */
  paused?: boolean
  /** A soft inner shadow under the ring, so the surface reads as set into the metal. Default true. */
  innerShadow?: boolean
  style?: StyleProp<ViewStyle>
}

/** Rings any box in liquid chrome. Bands drift round the edge, and thinking runs them faster under a breathing glow. */
export function MetalFrame({ children, shape = 'box', thinking = false, disabled = false, animated = true, strength = 1, ringCssPx = 1.5, borderRadius, paused = false, innerShadow = true, style }: MetalFrameProps) {
  const colors = useColors()
  const dark = useColorScheme() === 'dark'
  const styles = useMemo(() => createStyles(colors, dark), [colors, dark])
  const still = useStill(animated)
  const active = useAppActive()
  const corner = borderRadius ?? (shape === 'box' ? radius.card : radius.full)
  const glow = useSharedValue(1)

  useEffect(() => {
    if (!thinking || still || !active) {
      cancelAnimation(glow)
      if (!thinking || still) glow.value = 1
      return undefined
    }
    glow.value = 0.6
    glow.value = withRepeat(withTiming(1, { duration: BREATHE_MS, easing: IN_OUT }), -1, true)
    return () => cancelAnimation(glow)
  }, [thinking, still, active, glow])

  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))
  const round = { borderRadius: corner }

  return (
    <View aria-busy={thinking} style={[styles.frame, shape === 'circle' && styles.circle, disabled && styles.disabled, round, style]}>
      {thinking ? <Animated.View pointerEvents="none" style={[styles.glow, round, glowStyle]} /> : null}
      <View style={[styles.content, round]}>{children}</View>
      {innerShadow ? <View pointerEvents="none" style={[styles.inner, round]} /> : null}
      <MetalRing
        borderRadius={corner}
        ringCssPx={ringCssPx}
        strength={thinking ? 1 : strength}
        speed={thinking ? THINKING_SPEED : 1}
        paused={paused && !thinking}
        still={still || disabled}
      />
    </View>
  )
}

/** Shadow ink: near black in both schemes, as the soft shadow tokens. */
export const shadowInk = (c: Colors, dark: boolean): { color: string; opacity: number } => (dark ? { color: c.canvas, opacity: 0.6 } : { color: c.inverse, opacity: 0.12 })

const createStyles = (c: Colors, dark: boolean) => {
  const shade = shadowInk(c, dark)
  return StyleSheet.create({
    frame: { backgroundColor: c.surface, position: 'relative' },
    circle: { alignSelf: 'flex-start' },
    disabled: { opacity: 0.5 },
    content: { padding: space[0.5] },
    // The inset shadow token: 0 1 2 at the soft shadow ink, the alpha written as two hex digits.
    inner: { ...StyleSheet.absoluteFill, boxShadow: `inset 0px 1px 2px ${shade.color}${dark ? '99' : '1f'}` },
    glow: { ...StyleSheet.absoluteFill, backgroundColor: c.surface, elevation: 6, shadowColor: c.textPrimary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 9 },
  })
}
