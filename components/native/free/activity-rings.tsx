import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeOut, ZoomIn, useAnimatedProps, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import Svg, { Circle, G } from 'react-native-svg'
import { pressedState, radius, space, useColors, type Colors } from '../kit'
import { Badge } from './badge'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { Tween } from './usage-meter'

/** Rings load: 800 ms sweep, 80 ms stagger per ring, then the lap past 100%. */
const SWEEP_MS = 800
const SWEEP_STAGGER_MS = 80
const LAP_MS = 600
const BOX = 168
const CENTER = BOX / 2
const STROKE = 16
/** Outer radius of each ring in the 168 box. */
const RADII = [76, 56, 36] as const
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const round = (value: number): string => String(Math.round(value))

export type ActivityRing = {
  label: string
  value: number
  goal: number
  /** Shown after the goal, like `cal`. */
  unit: string
  /** Read out in the summary, like `calories`. Defaults to `unit`. */
  unitName?: string
  icon?: ReactNode
}

export type ActivityRingsProps = {
  /** Up to three rings, outer first. Default `activityRings(renderIcon)`. */
  rings?: ActivityRing[]
  title?: ReactNode
  date?: ReactNode
  /** The ring kept in focus. `null` for none. Leave it out to follow taps. */
  active?: number | null
  defaultActive?: number | null
  onActiveChange?: (active: number | null) => void
  renderIcon?: RenderIcon
  /** `false` shows final values with no sweep. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

export const activityRings = (renderIcon?: RenderIcon): ActivityRing[] => [
  { label: 'Move', value: 479, goal: 800, unit: 'cal', unitName: 'calories', icon: renderIcon?.('flame', 14) },
  { label: 'Exercise', value: 42, goal: 30, unit: 'min', unitName: 'minutes', icon: renderIcon?.('activity', 14) },
  { label: 'Stand', value: 6, goal: 12, unit: 'hr', unitName: 'hours', icon: renderIcon?.('footprints', 14) },
]

function Arc({ ring, share, delay, still, dim, color, track }: { ring: number; share: number; delay: number; still: boolean; dim: boolean; color: string; track: string }) {
  const length = Math.PI * 2 * ring
  const first = useSharedValue(still ? Math.min(share, 1) : 0)
  const lap = useSharedValue(0)
  const lapOpacity = useSharedValue(1)
  const overflow = Math.min(share - 1, 1)
  useEffect(() => {
    const target = Math.min(share, 1)
    if (still) { first.value = target; lap.value = 0; return }
    first.value = withDelay(delay, withTiming(target, { duration: SWEEP_MS, easing: EASE_OUT }))
    if (overflow <= 0) return
    lap.value = withDelay(delay + SWEEP_MS, withTiming(overflow, { duration: LAP_MS, easing: EASE_OUT }))
    lapOpacity.value = withDelay(delay + SWEEP_MS + LAP_MS, withTiming(0, { duration: LAP_MS / 2, easing: EASE_OUT }))
  }, [share, overflow, delay, still, first, lap, lapOpacity])
  const firstProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - first.value) }))
  const lapProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - lap.value), opacity: lapOpacity.value }))
  const shape = { cx: CENTER, cy: CENTER, r: ring, fill: 'none', strokeWidth: STROKE, strokeLinecap: 'round' as const }
  return (
    <>
      <Circle {...shape} stroke={track} />
      <G transform={`rotate(-90 ${CENTER} ${CENTER})`} opacity={dim ? 0.25 : 1}>
        <AnimatedCircle {...shape} animatedProps={firstProps} stroke={color} strokeDasharray={[length, length]} />
        {overflow > 0 && !still ? <AnimatedCircle {...shape} animatedProps={lapProps} stroke={color} strokeDasharray={[length, length]} /> : null}
      </G>
    </>
  )
}


/** Three goal rings in ink tones. A tap isolates one ring and its legend, and closing all three shows a success Badge. */
export function ActivityRings({ rings, title = 'Activity', date = 'Thursday, Oct 29', active, defaultActive = null, onActiveChange, renderIcon, animated = true, style }: ActivityRingsProps) {
  const styles = useThemed(createStyles)
  const c = useColors()
  const still = useStill(animated)
  const [pinned, setPinned] = useState(defaultActive)
  const focus = active !== undefined ? active : pinned
  const list = (rings ?? activityRings(renderIcon)).slice(0, RADII.length)
  const complete = list.every((ring) => ring.value >= ring.goal)
  const focused = focus === null ? undefined : list[focus]
  const tones = [c.textPrimary, c.textSecondary, c.textTertiary]

  function pin(index: number): void {
    const next = pinned === index ? null : index
    setPinned(next)
    onActiveChange?.(next)
  }

  const summary = list.map((ring) => `${ring.label} ${ring.value} of ${ring.goal} ${ring.unitName ?? ring.unit}`).join(', ')
  const badge = focused ? `${focused.label} · ${Math.round((focused.value / focused.goal) * 100)}%` : complete ? 'All rings closed' : `${list.length} of ${list.length} tracked`
  const closed = complete && !focused

  return (
    <Card animated={animated} style={style}>
      <View style={styles.header}>
        <View style={styles.text}><Text style={styles.title} accessibilityRole="header">{title}</Text><Text style={styles.small}>{date}</Text></View>
        <Animated.View key={closed ? 'done' : 'count'} {...(still ? {} : { entering: ZoomIn.springify().stiffness(500).damping(22), exiting: FadeOut.duration(120) })}>
          <Badge size="sm" tone={closed ? 'success' : 'neutral'} mark={closed} animated={animated}>{badge}</Badge>
        </Animated.View>
      </View>
      <View style={styles.row}>
        <Svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`} accessibilityRole="image" accessibilityLabel={summary}>
          {list.map((ring, index) => <Arc key={ring.label} ring={RADII[index] ?? 36} share={ring.value / ring.goal} delay={index * SWEEP_STAGGER_MS} still={still} dim={focus !== null && focus !== index} color={tones[index] ?? c.textTertiary} track={c.ink5} />)}
        </Svg>
        <View style={styles.legend}>
          {list.map((ring, index) => {
            const on = focus === index
            return (
              <Pressable key={ring.label} accessibilityRole="button" accessibilityLabel={`${ring.label}, ${ring.value} of ${ring.goal} ${ring.unitName ?? ring.unit}`} {...pressedState(on)} onPress={() => pin(index)} style={[styles.item, focus !== null && !on && styles.off]}>
                <View style={styles.dot}>{ring.icon}</View>
                <View style={styles.text}>
                  <Text style={styles.small}>{ring.label}</Text>
                  <View style={styles.value}><Tween value={ring.value} format={round} animated={animated} style={styles.number} /><Text style={styles.small}>/{ring.goal} {ring.unit}</Text></View>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  text: { flex: 1, gap: space[0.5] },
  title: type(16, c.textPrimary, '500'),
  small: type(12, c.textSecondary),
  row: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  legend: { flex: 1, gap: space[1] },
  item: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 44 },
  off: { opacity: 0.4 },
  dot: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 24, justifyContent: 'center', width: 24 },
  value: { alignItems: 'baseline', flexDirection: 'row' },
  number: type(16, c.textPrimary, '500'),
})
