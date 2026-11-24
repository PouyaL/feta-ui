import { useEffect, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn, cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed } from './card'
import { EASE_OUT, Mark, soft, useCompact } from './popover'

const MORPH = { stiffness: 400, damping: 30 }
const ENTER_Y = 12
const SHAKE_MS = 52
const SHAKE_X = 3
const EXPAND_MS = 260
const RING_MS = 200
const ROW_STAGGER_MS = 30
const SETTLED_MS = 5000
const RING_RADIUS = 11.5
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
const SPIN_MS = 900
const PULSE_MS = 1400
const SPREAD = Easing.bezierFn(0.4, 0, 0.2, 1)

const LAYOUT = LinearTransition.springify().stiffness(MORPH.stiffness).damping(MORPH.damping)
const TEXT_IN = FadeIn.duration(200).easing(EASE_OUT)
const TEXT_OUT = FadeOut.duration(200)
const TRAY_IN = FadeInDown.duration(EXPAND_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 8 }] })
const TRAY_OUT = FadeOut.duration(120)
const rowIn = (index: number) => FadeInDown.duration(EXPAND_MS).delay(index * ROW_STAGGER_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 4 }] })
const BADGE_IN = ZoomIn.springify().stiffness(500).damping(22).withInitialValues({ transform: [{ scale: 0.6 }] })

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export type StatusTask = {
  id: string
  state: 'running' | 'indeterminate' | 'done' | 'undo' | 'error'
  title: string
  detail?: string
  /** 0 to 100, for `running`. */
  progress?: number
  /** Open, Undo or Retry. */
  actionLabel?: string
  onAction?: () => void
}

export type StatusIslandProps = {
  /** The first is shown and the others wait behind it. */
  tasks: StatusTask[]
  /** A task finished showing: done and undo after 5 seconds, held while the tray is open. */
  onExpire?: (id: string) => void
  onClearDone?: () => void
  /** Opens the tray from the start. */
  defaultExpanded?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Spinning({ size, still, children }: { size: number; still: boolean; children: ReactNode }) {
  const turn = useSharedValue(0)
  const pulse = useSharedValue(1)
  useEffect(() => {
    if (still) pulse.value = withRepeat(withTiming(0.5, { duration: PULSE_MS, easing: SPREAD }), -1, true)
    else turn.value = withRepeat(withTiming(360, { duration: SPIN_MS, easing: Easing.linear }), -1, false)
    return () => {
      cancelAnimation(turn)
      cancelAnimation(pulse)
    }
  }, [pulse, still, turn])
  const spin = useAnimatedStyle(() => ({ height: size, opacity: pulse.value, width: size, transform: [{ rotate: `${turn.value}deg` }] }), [size])
  return <Animated.View style={spin}>{children}</Animated.View>
}

function Arc({ share, color }: { share: SharedValue<number>; color: string }) {
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH * (1 - share.value) }))
  return <AnimatedCircle cx={14} cy={14} r={RING_RADIUS} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeDasharray={RING_LENGTH} animatedProps={animatedProps} rotation={-90} origin="14, 14" />
}

function Ring({ value, size, still }: { value: number | null; size: number; still: boolean }) {
  const colors = useColors()
  const share = useSharedValue(value === null ? 0.28 : value / 100)
  useEffect(() => {
    share.value = withTiming(value === null ? 0.28 : value / 100, { duration: still ? 0 : RING_MS, easing: EASE_OUT })
  }, [share, still, value])
  const ring = (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Circle cx={14} cy={14} r={RING_RADIUS} fill="none" stroke={colors.ink10} strokeWidth={2.5} />
      <Arc share={share} color={colors.textPrimary} />
    </Svg>
  )
  if (value !== null) return <View accessibilityRole="progressbar" accessibilityLabel="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>{ring}</View>
  return <View accessibilityRole="progressbar" accessibilityLabel="Working"><Spinning size={size} still={still}>{ring}</Spinning></View>
}

function Leading({ task, size, still }: { task: StatusTask; size: number; still: boolean }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  if (task.state === 'running') return <Ring value={task.progress ?? 0} size={size} still={still} />
  if (task.state === 'indeterminate') return <Ring value={null} size={size} still={still} />
  const solid = task.state === 'done' || task.state === 'error'
  const glyph = task.state === 'done' ? <Mark name="tick" color={colors.textInverse} /> : task.state === 'undo' ? <Mark name="chevron-left" /> : <Mark name="x" color={colors.textInverse} />
  return <Animated.View {...(still ? {} : { entering: BADGE_IN })} style={[styles.badge, solid && (task.state === 'done' ? styles.badgeDone : styles.badgeError)]}>{glyph}</Animated.View>
}

function Waiting({ depth, still }: { depth: number; still: boolean }) {
  const styles = useThemed(createStyles)
  const lift = useSharedValue(still ? -7 * depth : 7)
  useEffect(() => { lift.value = withTiming(-7 * depth, { duration: still ? 0 : EXPAND_MS, easing: EASE_OUT }) }, [depth, lift, still])
  const peek = useAnimatedStyle(() => ({ opacity: depth === 1 ? 0.7 : 0.4, transform: [{ translateY: lift.value }, { scale: depth === 1 ? 0.94 : 0.88 }] }), [depth])
  return <Animated.View style={[styles.layer, peek]} />
}

/** A floating pill that reports background work. It morphs between states and opens into a tray of every task. */
export function StatusIsland({ tasks, onExpire, onClearDone, defaultExpanded = false, animated = true, style }: StatusIslandProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const compact = useCompact()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const task = tasks[0]
  const waiting = Math.min(tasks.length - 1, 2)
  const failed = task?.state === 'error'
  const ring = compact ? 32 : 28
  const shake = useSharedValue(0)
  const entry = useSharedValue(still ? 1 : 0)
  const spoken = task ? `${task.title}${task.detail ? `, ${task.detail}` : ''}` : ''

  useEffect(() => {
    entry.value = withTiming(1, { duration: still ? 0 : EXPAND_MS, easing: EASE_OUT })
  }, [entry, still])

  useEffect(() => {
    if (!task || !onExpire || expanded || (task.state !== 'done' && task.state !== 'undo')) return undefined
    const timer = setTimeout(() => onExpire(task.id), SETTLED_MS)
    return () => clearTimeout(timer)
  }, [task, onExpire, expanded])

  useEffect(() => {
    if (!failed || still) return
    const beat = { duration: SHAKE_MS, easing: EASE_OUT }
    shake.value = withSequence(withTiming(-SHAKE_X, beat), withTiming(SHAKE_X, beat), withTiming(-SHAKE_X, beat), withTiming(SHAKE_X, beat), withTiming(0, beat))
  }, [failed, shake, still])

  // Announced on its own, so the open tray is not read on every tick.
  useEffect(() => {
    if (spoken) AccessibilityInfo.announceForAccessibility(spoken)
  }, [spoken])

  const pillStyle = useAnimatedStyle(() => ({ opacity: entry.value, transform: [{ translateX: shake.value }, { translateY: (1 - entry.value) * ENTER_Y }, { scale: 0.96 + entry.value * 0.04 }] }))

  if (!task) return null
  const action = (item: StatusTask): ReactNode => (item.actionLabel ? <Button variant="ghost" size="sm" shape="pill" animated={animated} onPress={item.onAction}>{item.actionLabel}</Button> : null)
  const percent = (item: StatusTask): ReactNode => (item.state === 'running' ? <Text style={styles.percent}>{item.progress ?? 0}%</Text> : null)
  const doneCount = tasks.filter((item) => item.state === 'done').length

  return (
    <View style={[styles.root, style]}>
      {expanded ? (
        <Animated.View {...(still ? {} : { entering: TRAY_IN, exiting: TRAY_OUT })} style={[styles.tray, compact ? styles.trayPhone : styles.trayTablet]}>
          <View style={styles.trayHead}>
            <Text style={styles.trayTitle}>{tasks.length} TASKS</Text>
            {doneCount ? <Button variant="ghost" size="sm" animated={animated} onPress={onClearDone}>Clear done</Button> : null}
          </View>
          <View style={styles.rows}>
            {tasks.map((item, i) => (
              <Animated.View key={item.id} {...(still ? {} : { entering: rowIn(i) })} style={[styles.row, compact && styles.rowPhone, i > 0 && styles.rowRule]}>
                <Leading task={item} size={ring} still={still} />
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={styles.strong}>{item.title}</Text>
                  {item.detail ? <Text numberOfLines={1} style={styles.detail}>{item.detail}</Text> : null}
                </View>
                {percent(item)}
                {action(item)}
              </Animated.View>
            ))}
          </View>
        </Animated.View>
      ) : null}
      <View style={styles.stack}>
        {Array.from({ length: waiting }, (_, i) => <Waiting key={i} depth={i + 1} still={still} />)}
        <Animated.View {...(still ? {} : { layout: LAYOUT })} style={[styles.pill, compact && styles.pillPhone, failed && styles.pillError, pillStyle]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${tasks.length} background tasks`} aria-expanded={expanded} onPress={() => setExpanded(!expanded)} style={styles.pillMain}>
            <Leading task={task} size={ring} still={still} />
            <Animated.View key={`${task.id}-${task.state}`} {...(still ? {} : { entering: TEXT_IN, exiting: TEXT_OUT })} style={styles.pillText}>
              <Text numberOfLines={1} style={styles.pillLine}>
                <Text style={styles.strong}>{task.title}</Text>
                {task.detail ? ` · ${task.detail}` : ''}
              </Text>
            </Animated.View>
            {percent(task)}
            {tasks.length > 1 ? <Text style={styles.percent}>{tasks.length - 1}</Text> : null}
          </Pressable>
          {action(task)}
        </Animated.View>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  root: { alignItems: 'center', alignSelf: 'flex-start', gap: space[2], maxWidth: '100%' },
  stack: { alignItems: 'center', flexDirection: 'row', gap: space[1], maxWidth: '100%' },
  layer: { ...StyleSheet.absoluteFill, ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1 },
  pill: { ...soft(c), alignItems: 'center', backgroundColor: c.muted, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', gap: space[1], height: 40, maxWidth: '100%', paddingLeft: space[1], paddingRight: space[1.5], paddingVertical: space[1] },
  pillPhone: { height: 44 },
  pillError: { borderColor: c.danger, borderWidth: 1.5 },
  pillMain: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', flexShrink: 1, gap: space[2], height: '100%', minHeight: 44, minWidth: 0, paddingRight: space[1.5] },
  pillText: { flexShrink: 1, minWidth: 0 },
  pillLine: { ...type(14, c.textSecondary), lineHeight: 20 },
  strong: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  badge: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: 28, justifyContent: 'center', width: 28 },
  badgeDone: { backgroundColor: c.success },
  badgeError: { backgroundColor: c.danger },
  percent: { backgroundColor: c.ink5, borderRadius: radius.full, color: c.textSecondary, flexShrink: 0, fontFamily: font.mono, fontSize: 11, lineHeight: 14, overflow: 'hidden', paddingHorizontal: space[1.5], paddingVertical: space[0.5] },
  tray: { ...soft(c), backgroundColor: c.muted, borderColor: c.ink8, borderRadius: radius.tray, borderWidth: 1, maxWidth: '100%', padding: space[1] },
  trayPhone: { width: 358 },
  trayTablet: { width: 320 },
  trayHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 32, paddingLeft: space[3], paddingRight: space[1] },
  trayTitle: { color: c.textSecondary, fontFamily: font.mono, fontSize: 10, lineHeight: 14 },
  rows: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[2.5], minHeight: 52, paddingHorizontal: space[2.5], paddingVertical: space[1.5] },
  rowPhone: { minHeight: 56 },
  rowRule: { borderTopColor: c.ink5, borderTopWidth: 1 },
  rowText: { flex: 1, minWidth: 0 },
  detail: { ...type(12, c.textSecondary), lineHeight: 16 },
})
