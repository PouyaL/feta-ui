import { memo, useEffect, useId, useMemo, type ReactNode } from 'react'
import { StyleSheet, Text, View, useColorScheme, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { openLink, radius, space, useAppActive, useColors, type Colors } from '../kit'
import { PressScale, withInk, type PressScaleProps } from './button'
import { type, useStill, useThemed } from './card'

/** One slow lap of the rim at rest, like the web's 6 s turn. */
const TURN_MS = 6000
/** The silver face fades in on press over 240 ms. */
const FACE_MS = 240
const RIM = 2
/** Hits the 44 target from the 40 height. */
const SLOP = 2
/** Wedges in the drawn conic gradient: enough that the bands blend at a 2 pt rim. */
const WEDGES = 72

/** The web's --feta-chrome-* ramp, Light and Dark. */
const CHROME = {
  light: { hi: '#ffffff', mid: '#d4d4d8', lo: '#a1a1aa', deep: '#71717a' },
  dark: { hi: '#d4d4d8', mid: '#71717a', lo: '#3f3f46', deep: '#27272a' },
} as const

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** `color-mix(in srgb, a share, b)`. */
function mix(a: string, b: string, share: number): string {
  const x = rgb(a)
  const y = rgb(b)
  return `rgb(${x.map((v, i) => Math.round(v * share + (y[i] ?? 0) * (1 - share))).join(',')})`
}

/**
 * The web rim is `conic-gradient(from 135deg, hi, mid, lo, deep, lo, mid, hi)`. react-native-svg has no conic
 * gradient, so it is drawn as thin wedges, each filled with the ramp's colour at its middle angle.
 */
function conicWedges(stops: readonly string[]): { d: string; fill: string }[] {
  const out: { d: string; fill: string }[] = []
  const R = 1.5
  const point = (deg: number): string => {
    const a = (deg * Math.PI) / 180
    return `${(Math.sin(a) * R).toFixed(4)} ${(-Math.cos(a) * R).toFixed(4)}`
  }
  for (let i = 0; i < WEDGES; i++) {
    const t = (i + 0.5) / WEDGES
    const span = t * (stops.length - 1)
    const at = Math.min(Math.floor(span), stops.length - 2)
    const from = stops[at] ?? stops[0] ?? '#000000'
    const to = stops[at + 1] ?? from
    const a0 = 135 + (i / WEDGES) * 360
    // Each wedge overlaps the next by a hair so no seam shows between them.
    const a1 = 135 + ((i + 1.15) / WEDGES) * 360
    out.push({ d: `M0 0L${point(a0)}L${point(a1)}Z`, fill: mix(to, from, span - at) })
  }
  return out
}

export type MetallicLinkProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  kind?: 'default' | 'inverted'
  /** The URL to open. */
  href?: string
  /** Usually `arrow-up-right`. */
  icon?: ReactNode
  children?: ReactNode
  /** `false` stills the turning rim, the silver face and the press scale. */
  animated?: boolean
}

/** The 72 wedge rim. Memoised: it redraws only when the chrome ramp changes, not on press or layout renders. */
const Rim = memo(function Rim({ wedges }: { wedges: { d: string; fill: string }[] }) {
  return (
    <Svg aria-hidden width="100%" height="100%" viewBox="-1 -1 2 2">
      {wedges.map((w, i) => <Path key={i} d={w.d} fill={w.fill} />)}
    </Svg>
  )
})

/** A link styled as a pill inside a chrome rim. The rim turns at rest; a press fills the face with silver. */
export function MetallicLink({ kind = 'default', href, icon, children, animated = true, disabled, style, onPress, onPressIn, onPressOut, onLayout, accessibilityLabel, ...rest }: MetallicLinkProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const dark = useColorScheme() === 'dark'
  const still = useStill(animated) || Boolean(disabled)
  const active = useAppActive()
  const inverted = kind === 'inverted'
  const turn = useSharedValue(0)
  const face = useSharedValue(0)
  const width = useSharedValue(0)
  const height = useSharedValue(0)

  const chrome = dark ? CHROME.dark : CHROME.light
  const wedges = useMemo(() => conicWedges([chrome.hi, chrome.mid, chrome.lo, chrome.deep, chrome.lo, chrome.mid, chrome.hi]), [chrome])
  const base = inverted ? colors.inverse : colors.surface
  const silverHi = mix(chrome.hi, base, 0.55)
  const silverLo = mix(chrome.lo, base, 0.3)

  useEffect(() => {
    if (still || !active) {
      cancelAnimation(turn)
      turn.value = 0
      return
    }
    turn.value = 0
    turn.value = withRepeat(withTiming(360, { duration: TURN_MS, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(turn)
  }, [still, active, turn])

  // A square as wide as the pill's diagonal turns behind the face, so the 2 pt ring always shows the ramp.
  const rimStyle = useAnimatedStyle(() => {
    const side = Math.hypot(width.value, height.value)
    return { height: side, left: (width.value - side) / 2, top: (height.value - side) / 2, transform: [{ rotate: `${turn.value}deg` }], width: side }
  })
  const faceStyle = useAnimatedStyle(() => ({ opacity: face.value }))
  // Gradient ids per link, so two links on a screen never share defs.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')

  function handleIn(event: GestureResponderEvent): void {
    face.value = still ? 1 : withTiming(1, { duration: FACE_MS, easing: Easing.out(Easing.quad) })
    onPressIn?.(event)
  }

  function handleOut(event: GestureResponderEvent): void {
    face.value = still ? 0 : withTiming(0, { duration: FACE_MS, easing: Easing.out(Easing.quad) })
    onPressOut?.(event)
  }

  function handleLayout(event: LayoutChangeEvent): void {
    width.value = event.nativeEvent.layout.width
    height.value = event.nativeEvent.layout.height
    onLayout?.(event)
  }

  function handlePress(event: GestureResponderEvent): void {
    onPress?.(event)
    if (href) openLink(href)
  }

  return (
    <PressScale
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
      still={still}
      disabled={disabled}
      hitSlop={SLOP}
      style={[styles.box, disabled ? styles.disabled : null, style]}
      contentStyle={styles.rim}
      onPress={handlePress}
      onPressIn={handleIn}
      onPressOut={handleOut}
      onLayout={handleLayout}
      {...rest}
    >
      <Animated.View pointerEvents="none" style={[styles.chrome, rimStyle]}>
        <Rim wedges={wedges} />
      </Animated.View>
      <View style={[styles.face, inverted && styles.faceInverted]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, faceStyle]}>
          <Svg aria-hidden width="100%" height="100%">
            <Defs>
              {/* The web's 110 degree silver band where it rests before it drifts: low, high at 60 %, low. */}
              <LinearGradient id={`silver${uid}`} x1="0" y1="0" x2="1" y2="0.2">
                <Stop offset="0" stopColor={silverLo} />
                <Stop offset="0.6" stopColor={silverHi} />
                <Stop offset="1" stopColor={silverLo} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#silver${uid})`} />
          </Svg>
        </Animated.View>
        <Text numberOfLines={1} style={[styles.label, inverted && styles.labelInverted]}>{children}</Text>
        {withInk(icon, inverted ? colors.textInverse : colors.textPrimary)}
      </View>
    </PressScale>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  disabled: { opacity: 0.4 },
  rim: { borderRadius: radius.full, height: 40, overflow: 'hidden', padding: RIM },
  chrome: { position: 'absolute' },
  face: { alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.full, flex: 1, flexDirection: 'row', gap: space[1.5], overflow: 'hidden', paddingLeft: space[3.5], paddingRight: space[3] },
  faceInverted: { backgroundColor: c.inverse },
  label: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  labelInverted: { color: c.textInverse },
})
