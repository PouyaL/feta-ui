import { useEffect } from 'react'
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { useColors } from '../kit'
import { useStill } from './card'

const VIEW_WIDTH = 180
const VIEW_HEIGHT = 214
const SHAKE_STOPS = [-5, 5, -3, 3, 0]
const SHAKE_MS = 320
const PRESS = { stiffness: 600, damping: 32, mass: 1 } as const
const STAMP = { stiffness: 500, damping: 22, mass: 1 } as const
const LIFT: Record<PadlockStatus, number> = { locked: 0, checking: -10, open: -28, error: 0 }
const RINGS = [[76, 136], [104, 136], [76, 164], [104, 164]] as const

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
  const height = (width * VIEW_HEIGHT) / VIEW_WIDTH
  const scale = width / VIEW_WIDTH
  const lift = useSharedValue(LIFT[status])
  const x = useSharedValue(0)
  const emblem = status === 'open' ? colors.success : status === 'error' ? colors.danger : colors.textInverse

  useEffect(() => {
    lift.value = still ? LIFT[status] : withSpring(LIFT[status], status === 'open' ? STAMP : PRESS)
    if (status === 'error' && !still) x.value = withSequence(...SHAKE_STOPS.map((stop) => withTiming(stop, { duration: SHAKE_MS / SHAKE_STOPS.length })))
  }, [status, still, lift, x])

  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const shackle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value * scale }] }))

  return (
    <Animated.View
      aria-hidden={!accessibilityLabel}
      {...(accessibilityLabel ? { accessible: true, accessibilityLabel, accessibilityRole: 'image' as const } : {})}
      style={[{ height, width }, shake, style]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shackle]}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
          <Defs>
            <LinearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.textTertiary} />
              <Stop offset="0.45" stopColor={colors.muted} />
              <Stop offset="1" stopColor={colors.textTertiary} />
            </LinearGradient>
          </Defs>
          <Path d="M46 100 V62 a44 44 0 0 1 88 0 V100" fill="none" stroke="url(#steel)" strokeLinecap="round" strokeWidth={16} />
          <Path d="M52 92 V62 a38 38 0 0 1 24 -35" fill="none" stroke={colors.surface} strokeLinecap="round" strokeOpacity={0.55} strokeWidth={2} />
        </Svg>
      </Animated.View>
      <View style={StyleSheet.absoluteFill}>
        <Svg width={width} height={height} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
          <Defs>
            <LinearGradient id="body" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.textSecondary} />
              <Stop offset="1" stopColor={colors.textPrimary} />
            </LinearGradient>
          </Defs>
          <Rect x={16} y={94} width={148} height={112} rx={22} fill="url(#body)" />
          <Rect x={17} y={95} width={146} height={110} rx={21} fill="none" stroke={colors.surface} strokeOpacity={0.16} strokeWidth={2} />
          <G fill="none" stroke={emblem} strokeWidth={3}>
            {RINGS.map(([cx, cy]) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={16} />)}
          </G>
        </Svg>
      </View>
    </Animated.View>
  )
}
