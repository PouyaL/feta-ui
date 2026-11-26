import { useEffect, useId } from 'react'
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle, ClipPath, Defs, Ellipse, FeGaussianBlur, Filter, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import { useColors } from '../kit'
import { useStill } from './card'

/*
 * The web's gunmetal padlock, drawn in the same 180 by 214 space: a chrome shackle with a specular line, a zinc body
 * with a lit top bevel, a shaded foot and a soft sheen, two sockets, the engraved four ring emblem, a cast shadow and
 * a floor shadow. The metal is fixed on purpose so it reads the same in Light and Dark; only the emblem takes status
 * colour. The web's SVG filters become Gaussian blurs on fixed user-space regions and plain strokes.
 */
const VIEW_WIDTH = 180
const VIEW_HEIGHT = 214
/** The cast and floor shadows spill past the box: the shadow layer draws this much further round it. */
const SPILL = { x: 50, top: 0, bottom: 60 } as const
const SHAKE_STOPS = [-6, 5, -4, 3, -1.5, 0]
const SHAKE_MS = 320
const PRESS = { stiffness: 600, damping: 32, mass: 1 } as const
const STAMP = { stiffness: 500, damping: 22, mass: 1 } as const
const LIFT: Record<PadlockStatus, number> = { locked: 0, checking: -10, open: -28, error: 0 }
const RINGS = [[81, 140], [99, 140], [99, 158], [81, 158]] as const
const BODY = { x: 22, y: 92, width: 136, height: 114, rx: 26 } as const
/** The zinc ramp, from tokens.css. */
const ZINC = { 200: '#e4e4e7', 400: '#a1a1aa', 500: '#71717a', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#09090b' } as const
/** zinc-400 at 60% over zinc-500, as the web mixes it. */
const STEEL_MID = '#8d8d95'
const WHITE = '#ffffff'
const BLACK = '#000000'

export type PadlockStatus = 'locked' | 'checking' | 'open' | 'error'

export type PadlockProps = {
  status?: PadlockStatus
  /** Width. Height follows at 180 by 214. */
  width?: number
  /** Names the picture. Without it the lock is decorative. */
  accessibilityLabel?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A padlock whose shackle lifts as a code is checked. */
export function Padlock({ status = 'locked', width = VIEW_WIDTH, accessibilityLabel, animated = true, style }: PadlockProps) {
  const colors = useColors()
  const still = useStill(animated)
  const id = `pl${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const url = (name: string): string => `url(#${id}-${name})`
  const height = (width * VIEW_HEIGHT) / VIEW_WIDTH
  const scale = width / VIEW_WIDTH
  const lift = useSharedValue(LIFT[status])
  const x = useSharedValue(0)
  const lit = status === 'open' ? colors.success : status === 'error' ? colors.danger : null

  useEffect(() => {
    lift.value = still ? LIFT[status] : withSpring(LIFT[status], status === 'open' ? STAMP : PRESS)
    if (status === 'error' && !still) x.value = withSequence(...SHAKE_STOPS.map((stop) => withTiming(stop, { duration: SHAKE_MS / SHAKE_STOPS.length })))
  }, [status, still, lift, x])

  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * scale }] }))
  const shackle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value * scale }] }))
  const layer = { width, height, viewBox: `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}` }
  const spill = { left: -SPILL.x * scale, top: -SPILL.top * scale, width: (VIEW_WIDTH + SPILL.x * 2) * scale, height: (VIEW_HEIGHT + SPILL.top + SPILL.bottom) * scale }

  return (
    <Animated.View
      aria-hidden={!accessibilityLabel}
      {...(accessibilityLabel ? { accessible: true, accessibilityLabel, accessibilityRole: 'image' as const } : {})}
      style={[{ height, width }, style]}
    >
      {/* The floor and the cast shadow, drawn wider than the box so their blur is never cut off. The floor stays put while the lock shakes. */}
      <View pointerEvents="none" style={[styles.spill, spill]}>
        <Svg aria-hidden width={spill.width} height={spill.height} viewBox={`${-SPILL.x} ${-SPILL.top} ${VIEW_WIDTH + SPILL.x * 2} ${VIEW_HEIGHT + SPILL.top + SPILL.bottom}`}>
          <Defs>
            <Filter id={`${id}-floor`} x={0} y={180} width={VIEW_WIDTH} height={60} filterUnits="userSpaceOnUse"><FeGaussianBlur stdDeviation={5} /></Filter>
            <Filter id={`${id}-far`} x={-SPILL.x} y={60} width={VIEW_WIDTH + SPILL.x * 2} height={VIEW_HEIGHT} filterUnits="userSpaceOnUse"><FeGaussianBlur stdDeviation={20} /></Filter>
            <Filter id={`${id}-near`} x={-20} y={80} width={VIEW_WIDTH + 40} height={160} filterUnits="userSpaceOnUse"><FeGaussianBlur stdDeviation={7} /></Filter>
          </Defs>
          <Ellipse cx={90} cy={206} rx={70} ry={8} fill={BLACK} fillOpacity={0.28} filter={url('floor')} />
          <Rect {...BODY} y={BODY.y + 26} fill={BLACK} fillOpacity={0.38} filter={url('far')} />
          <Rect {...BODY} y={BODY.y + 8} fill={BLACK} fillOpacity={0.22} filter={url('near')} />
        </Svg>
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, shake]}>
        <Animated.View style={[StyleSheet.absoluteFill, shackle]}>
          <Svg aria-hidden {...layer}>
            <Defs>
              <LinearGradient id={`${id}-steel`} gradientUnits="userSpaceOnUse" x1={37.5} y1={0} x2={142.5} y2={0}>
                <Stop offset="0" stopColor={ZINC[800]} />
                <Stop offset="0.18" stopColor={STEEL_MID} />
                <Stop offset="0.30" stopColor={ZINC[200]} />
                <Stop offset="0.42" stopColor={ZINC[500]} />
                <Stop offset="0.62" stopColor={ZINC[800]} />
                <Stop offset="0.82" stopColor={ZINC[600]} />
                <Stop offset="1" stopColor={ZINC[900]} />
              </LinearGradient>
            </Defs>
            <Path d="M46 142 V58 C46 30 66 12 90 12 C114 12 134 30 134 58 V112" fill="none" stroke={url('steel')} strokeWidth={17} strokeLinecap="round" />
            <Path d="M41 150 V58 C41 34 56 17 76 14" fill="none" stroke={WHITE} strokeOpacity={0.55} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </Animated.View>
        <View style={StyleSheet.absoluteFill}>
          <Svg aria-hidden {...layer}>
            <Defs>
              <LinearGradient id={`${id}-body`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={ZINC[700]} />
                <Stop offset="0.22" stopColor={ZINC[800]} />
                <Stop offset="0.70" stopColor={ZINC[900]} />
                <Stop offset="1" stopColor={ZINC[950]} />
              </LinearGradient>
              <LinearGradient id={`${id}-foot`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.55" stopColor={BLACK} stopOpacity={0} />
                <Stop offset="1" stopColor={BLACK} stopOpacity={0.45} />
              </LinearGradient>
              <RadialGradient id={`${id}-sheen`} gradientUnits="userSpaceOnUse" cx={104.6} cy={136} fx={104.6} fy={136} rx={48.6} ry={25.9}>
                <Stop offset="0" stopColor={WHITE} stopOpacity={0.16} />
                <Stop offset="1" stopColor={WHITE} stopOpacity={0} />
              </RadialGradient>
              <ClipPath id={`${id}-face`}><Rect {...BODY} /></ClipPath>
              <Filter id={`${id}-soft`} x={20} y={86} width={140} height={22} filterUnits="userSpaceOnUse"><FeGaussianBlur stdDeviation={1} /></Filter>
              <Filter id={`${id}-glow`} x={60} y={118} width={60} height={62} filterUnits="userSpaceOnUse"><FeGaussianBlur stdDeviation={3} /></Filter>
            </Defs>
            <Rect {...BODY} fill={url('body')} />
            <G clipPath={url('face')}>
              <Rect {...BODY} fill={url('foot')} />
              {/* The lit top bevel and the faint lit left edge. */}
              <Rect x={BODY.x} y={BODY.y + 1.5} width={BODY.width} height={BODY.height} rx={BODY.rx} fill="none" stroke={WHITE} strokeOpacity={0.28} strokeWidth={3} />
              <Rect x={BODY.x + 2} y={BODY.y} width={BODY.width} height={BODY.height} rx={BODY.rx} fill="none" stroke={WHITE} strokeOpacity={0.06} strokeWidth={4} />
            </G>
            <Rect {...BODY} fill={url('sheen')} />
            <Ellipse cx={46} cy={97} rx={11} ry={4} fill={BLACK} fillOpacity={0.55} filter={url('soft')} />
            {status === 'open'
              ? <Ellipse cx={134} cy={97.5} rx={9.5} ry={3} fill={BLACK} fillOpacity={0.8} stroke={WHITE} strokeOpacity={0.12} strokeWidth={1} />
              : <Ellipse cx={134} cy={97} rx={11} ry={4} fill={BLACK} fillOpacity={0.55} filter={url('soft')} />}
            {/* The engraved emblem: a dark cut with a hairline of light below it. */}
            <G fill="none">
              {RINGS.map(([cx, cy]) => <Circle key={`l${cx}${cy}`} cx={cx} cy={cy + 1} r={12.5} stroke={WHITE} strokeOpacity={0.1} strokeWidth={1} />)}
              {RINGS.map(([cx, cy]) => <Circle key={`r${cx}${cy}`} cx={cx} cy={cy} r={12.2} stroke={BLACK} strokeOpacity={0.75} strokeWidth={1.6} />)}
            </G>
            {lit ? (
              <>
                <G fill="none" stroke={lit} strokeOpacity={0.8} strokeWidth={1.6} filter={url('glow')}>
                  {RINGS.map(([cx, cy]) => <Circle key={`g${cx}${cy}`} cx={cx} cy={cy} r={12.2} />)}
                </G>
                <G fill="none" stroke={lit} strokeWidth={1.6}>
                  {RINGS.map(([cx, cy]) => <Circle key={`s${cx}${cy}`} cx={cx} cy={cy} r={12.2} />)}
                </G>
              </>
            ) : null}
          </Svg>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  spill: { position: 'absolute' },
})
