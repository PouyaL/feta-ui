import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type DimensionValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { font, radius, space, useColors, useReduceMotion, type Colors } from '../kit'
import { Spinner } from './spinner'

const SHEEN_MS = 1600
const SHOW_MS = 160
const PULSE_MS = 1000
const SHEEN_SHARE = 0.45
const SHEEN_TRAVEL = 3.22
const ARRIVE_MS = 240
const ROW_STAGGER_MS = 40
const SPREAD = Easing.bezier(0.4, 0, 0.2, 1)
const OUT = Easing.bezier(0.23, 1, 0.32, 1)

export type SkeletonProps = {
  /** Line for text and pills, Circle for avatars, Block for media and inputs. Default `line`. */
  shape?: 'line' | 'circle' | 'block'
  /** Points or percentage. Line defaults to 100%. */
  width?: DimensionValue
  /** Height, and width too for a circle. */
  height?: DimensionValue
  /** Shimmer on main content, `false` on secondary parts. Default `true`. */
  shimmer?: boolean
  /** Milliseconds to wait before showing. Use 300 on fast connections. */
  delay?: number
  /** `false` drops the sheen. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A placeholder in the shape of content on its way. Hidden from assistive tech. */
export function Skeleton({ shape = 'line', width, height, shimmer = true, delay = 0, animated = true, style }: SkeletonProps) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [wide, setWide] = useState(0)
  const sweep = useSharedValue(0)
  const pulse = useSharedValue(1)
  const shown = useSharedValue(delay > 0 ? 0 : 1)
  const sheen = shimmer && animated && !reduce

  useEffect(() => {
    if (sheen) sweep.value = withRepeat(withTiming(1, { duration: SHEEN_MS, easing: SPREAD }), -1, false)
    else if (shimmer && animated) pulse.value = withRepeat(withSequence(withTiming(0.7, { duration: PULSE_MS, easing: Easing.linear }), withTiming(1, { duration: PULSE_MS, easing: Easing.linear })), -1)
    return () => {
      cancelAnimation(sweep)
      cancelAnimation(pulse)
      sweep.value = 0
      pulse.value = 1
    }
  }, [sheen, shimmer, animated, sweep, pulse])

  useEffect(() => {
    if (delay > 0) shown.value = withDelay(delay, withTiming(1, { duration: animated ? SHOW_MS : 0, easing: OUT }))
  }, [delay, animated, shown])

  const fade = useAnimatedStyle(() => ({ opacity: shown.value * pulse.value }))
  const band = wide * SHEEN_SHARE
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: band * (sweep.value * SHEEN_TRAVEL - 1) }] }))
  const box = useMemo<ViewStyle>(() => {
    const tall = height ?? (shape === 'line' ? 12 : 36)
    return { height: tall, width: shape === 'circle' ? tall : (width ?? '100%') }
  }, [shape, width, height])
  const measure = (e: LayoutChangeEvent): void => setWide(e.nativeEvent.layout.width)
  // One gradient id per skeleton, so a screen of skeletons never shares defs.
  const sheenId = `sheen${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <Animated.View
      onLayout={measure}
      aria-hidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.skeleton, shape === 'block' ? styles.block : null, box, fade, style]}
    >
      {sheen && band > 0 ? (
        <Animated.View style={[styles.sheen, slide]}>
          <Svg aria-hidden width={band} height="100%">
            <Defs>
              <LinearGradient id={sheenId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.ink8} stopOpacity={0} />
                <Stop offset="0.5" stopColor={colors.ink8} />
                <Stop offset="1" stopColor={colors.ink8} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={band} height="100%" fill={`url(#${sheenId})`} />
          </Svg>
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

export type SkeletonShellProps = {
  /** Keep what is already known. */
  title: string
  /** Mono status beside the ring. Default `LOADING`. */
  status?: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/** The tray and inset card around a loading layout. The region is marked busy. */
export function SkeletonShell({ title, status = 'LOADING', children, style }: SkeletonShellProps) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <View aria-busy style={[styles.shell, style]}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <View style={styles.statusRow}>
          <Spinner size={10} label={null} color={colors.textTertiary} />
          <Text style={styles.status}>{status}</Text>
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  )
}

export type SkeletonArriveProps = {
  /** Row position, top to bottom, for the 40 ms stagger. */
  index?: number
  animated?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/** Wraps real content as it replaces a skeleton, so it fades in over the shape. */
export function SkeletonArrive({ index = 0, animated = true, style, children }: SkeletonArriveProps) {
  const reduce = useReduceMotion()
  const opacity = useSharedValue(animated ? 0 : 1)
  useEffect(() => {
    if (animated) opacity.value = withDelay(reduce ? 0 : index * ROW_STAGGER_MS, withTiming(1, { duration: ARRIVE_MS, easing: OUT }))
  }, [animated, reduce, index, opacity])
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[fade, style]}>{children}</Animated.View>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  skeleton: { maxWidth: '100%', overflow: 'hidden', borderRadius: radius.full, backgroundColor: c.ink5 },
  block: { borderRadius: radius.xl },
  sheen: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  shell: { width: '100%', padding: space[1], borderRadius: radius.frame, backgroundColor: c.ink4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], paddingVertical: space[2], paddingHorizontal: space[3] },
  title: { flexShrink: 1, fontFamily: font.sans, fontSize: 14, lineHeight: 18, fontWeight: '500', letterSpacing: font.tracking(14), color: c.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  status: { fontFamily: font.mono, fontSize: 11, lineHeight: 14, color: c.textTertiary },
  body: { padding: space[4], borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
})
