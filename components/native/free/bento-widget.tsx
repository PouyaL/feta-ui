import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, runOnJS, useAnimatedProps, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { font, radius, space, useColors, type Colors } from '../kit'
import { withInk } from './button'
import { ROW_MS, type RenderIcon, type, useStill, useThemed } from './card'
import { Checkbox } from './checkbox'

const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
/** Value arrives: 600 ms, bars stagger 20 ms, from the 16.5 Motion frame. */
const ARRIVE = { duration: 600, easing: EASE_OUT }
const BAR_STAGGER_MS = 20
const FILL_MS = 200
const SPARK_HEIGHT = 40
const SPARK_WIDTH = 408
const enter = FadeIn.duration(ROW_MS)

const AnimatedPath = Animated.createAnimatedComponent(Path)

const money = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`
const whole = (value: number): string => Math.round(value).toLocaleString('en-US')
const percent = (value: number): string => `${value.toFixed(2)}%`
const gigabytes = (value: number): string => `${Math.round(value)} GB`

export type BentoWidgetKind = 'revenue' | 'active-users' | 'activity' | 'notes' | 'uptime' | 'storage'
export type BentoWidgetSize = 'small' | 'medium' | 'large'

export type RevenueData = { value: number; change: string; note: string; points: number[]; breakdown: { label: string; amount: string }[] }
export type ActiveUsersData = { value: number; change: string; note: string; shortNote: string; days: { label: string; value: number }[] }
export type ActivityData = { events: { text: string; time: string }[]; latestWhen: string }
export type NoteItem = { id: string; text: string; done: boolean }
export type NotesData = { title: string; items: NoteItem[]; /** Ids shown at Medium, in order. Default the first three. */ featured?: string[] }
export type UptimeData = { value: number; summary: string; /** Days ago, shown in status colour. */ incident: number; incidentNote: string }
export type StorageData = { used: number; total: number; parts: { label: string; size: number }[] }

export const BENTO_DATA = {
  revenue: {
    value: 48210, change: '+12.4%', note: 'vs last month',
    points: [34, 27.9, 25.9, 20.7, 18.4, 18, 21.8, 24, 16.8, 15.7, 18.4, 13.8, 12, 6.3, 9.1, 6, 1.1, 0],
    breakdown: [{ label: 'New', amount: '$6,140' }, { label: 'Expansion', amount: '$2,380' }, { label: 'Churned', amount: '−$1,190' }],
  } satisfies RevenueData,
  'active-users': {
    value: 2841, change: '+6.2%', note: 'active today', shortNote: 'today',
    days: [32, 37, 36, 38, 41, 24, 48, 34, 36, 35, 39, 40, 27, 48].map((value, index) => ({ label: 'MTWTFSS'[index % 7] ?? '', value })),
  } satisfies ActiveUsersData,
  activity: {
    latestWhen: 'Today, 09:41',
    events: [{ text: 'Release 4.2 promoted to production', time: '09:41' }, { text: 'Invoice 2041 paid', time: '09:12' }, { text: 'New teammate joined Design', time: '08:55' }, { text: 'Nightly backup verified', time: 'Mon' }],
  } satisfies ActivityData,
  notes: {
    title: 'Q4 planning',
    featured: ['pricing', 'review', 'hiring'],
    items: [
      { id: 'roadmap', text: 'Draft Q4 roadmap', done: true }, { id: 'pricing', text: 'Pick pricing experiment', done: true }, { id: 'hiring', text: 'Share hiring plan', done: false },
      { id: 'onboarding', text: 'Review onboarding copy', done: true }, { id: 'review', text: 'Book design review', done: false },
    ],
  } satisfies NotesData,
  uptime: { value: 99.98, summary: 'All systems normal', incident: 18, incidentNote: 'One incident 18 days ago: slower API responses for 4 minutes.' } satisfies UptimeData,
  storage: { used: 342, total: 500, parts: [{ label: 'Media', size: 182 }, { label: 'Documents', size: 96 }, { label: 'Backups', size: 64 }] } satisfies StorageData,
}

type Base = {
  /** Default `small`: the number. `medium` adds the chart or list, `large` adds the breakdown. */
  size?: BentoWidgetSize
  /** Replaces the six dots, as Bento Grid does with its move control. */
  grip?: ReactNode
  /** Fills its cell instead of the width of its size. */
  fill?: boolean
  /** Shows the raised look, for previews and a lifted tile. */
  hovered?: boolean
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

export type BentoWidgetProps = Base & (
  | { widget: 'revenue'; data?: RevenueData }
  | { widget: 'active-users'; data?: ActiveUsersData }
  | { widget: 'activity'; data?: ActivityData }
  | { widget: 'notes'; data?: NotesData; onItemsChange?: (items: NoteItem[]) => void }
  | { widget: 'uptime'; data?: UptimeData }
  | { widget: 'storage'; data?: StorageData }
)

const LABEL: Record<BentoWidgetKind, [string, string]> = {
  revenue: ['Revenue', 'activity'], 'active-users': ['Active users', 'user'], activity: ['Activity', 'clock'], notes: ['Notes', 'file-text'], uptime: ['Uptime', 'activity'], storage: ['Storage', 'hard-drive'],
}

/**
 * A number that counts up from 0 once. The value tweens on the UI thread and each frame's text lands in state: the
 * count is short, and setNativeProps text is not reliable on the New Architecture or available on web.
 */
function CountUp({ value, format, still, style }: { value: number; format: (value: number) => string; still: boolean; style: StyleProp<TextStyle> }) {
  const shown = useSharedValue(still ? value : 0)
  const [text, setText] = useState(() => format(still ? value : 0))
  const shownText = useRef(text)
  const formatRef = useRef(format)
  formatRef.current = format
  const write = (latest: number): void => {
    const next = formatRef.current(latest)
    if (next !== shownText.current) { shownText.current = next; setText(next) }
  }
  useAnimatedReaction(() => shown.value, (latest, previous) => { if (latest !== previous) runOnJS(write)(latest) })
  useEffect(() => {
    shown.value = still ? value : withTiming(value, ARRIVE)
  }, [shown, still, value])
  return <TextInput editable={false} scrollEnabled={false} value={text} accessibilityLabel={format(value)} style={[reset, style]} />
}

const reset: TextStyle = { padding: 0 }

/** The six dots of a grip. */
export function BentoGripDots({ hovered = false }: { hovered?: boolean }) {
  const styles = useThemed(createStyles)
  return (
    <View style={[styles.dots, hovered && styles.dotsOn]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((row) => <View key={row} style={styles.dotRow}><View style={styles.gripDot} /><View style={styles.gripDot} /></View>)}
    </View>
  )
}

function Spark({ points, still }: { points: number[]; still: boolean }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const [width, setWidth] = useState(0)
  const shown = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    shown.value = still ? 1 : withTiming(1, ARRIVE)
  }, [shown, still])
  const scale = width / SPARK_WIDTH
  const step = width / (points.length - 1)
  const coords = points.map((y, index): [number, number] => [index * step, y + 4])
  const line = coords.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ')
  const length = coords.reduce((sum, [x, y], index) => {
    const [px = x, py = y] = coords[index - 1] ?? []
    return sum + Math.hypot(x - px, y - py)
  }, 0)
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - shown.value) }))
  const areaProps = useAnimatedProps(() => ({ opacity: shown.value }))
  return (
    <View style={styles.spark} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {scale > 0 ? (
        <Svg aria-hidden width={width} height={SPARK_HEIGHT}>
          <AnimatedPath animatedProps={areaProps} d={`${line} L ${width} ${SPARK_HEIGHT} L 0 ${SPARK_HEIGHT} Z`} fill={colors.ink5} />
          <AnimatedPath animatedProps={lineProps} d={line} fill="none" stroke={colors.textPrimary} strokeWidth={1.5} strokeLinejoin="round" strokeDasharray={[length, length]} />
        </Svg>
      ) : null}
    </View>
  )
}

function Bar({ value, top, now, index, still }: { value: number; top: number; now: boolean; index: number; still: boolean }) {
  const styles = useThemed(createStyles)
  const grown = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    grown.value = still ? 1 : withDelay(index * BAR_STAGGER_MS, withTiming(1, ARRIVE))
  }, [grown, index, still])
  const share = `${(value / top) * 100}%` as const
  const barStyle = useAnimatedStyle(() => ({ height: share, transform: [{ scaleY: grown.value }] }), [share])
  return <Animated.View style={[styles.bar, now && styles.barNow, barStyle]} />
}

/** A thin bar filled by scale. `arrives` starts it from empty. */
function Track({ share, arrives, thin = false, label, still }: { share: number; arrives: boolean; thin?: boolean; label: string; still: boolean }) {
  const styles = useThemed(createStyles)
  const fill = useSharedValue(arrives && !still ? 0 : share)
  useEffect(() => {
    fill.value = still ? share : withTiming(share, arrives ? ARRIVE : { duration: FILL_MS, easing: EASE_OUT })
  }, [arrives, fill, share, still])
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }))
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} style={[styles.track, thin && styles.trackThin]}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  )
}

function Segment({ share, step }: { share: number; step: number }) {
  const styles = useThemed(createStyles)
  const width = `${share * 100}%` as const
  const sized = useAnimatedStyle(() => ({ width }), [width])
  return <Animated.View style={[styles.segment, step === 0 ? styles.step0 : step === 1 ? styles.step1 : styles.step2, sized]} />
}

function Revenue({ data, size, still }: { data: RevenueData; size: BentoWidgetSize; still: boolean }) {
  const styles = useThemed(createStyles)
  const main = (
    <>
      <CountUp value={data.value} format={money} still={still} style={styles.value} />
      <View style={styles.delta}><Text style={styles.change}>{data.change}</Text><Text style={styles.meta}>{data.note}</Text></View>
    </>
  )
  if (size === 'small') return <><View style={styles.push} />{main}</>
  const chart = <><View style={styles.gap2} /><Spark points={data.points} still={still} /></>
  if (size === 'medium') return <>{main}{chart}</>
  return (
    <View style={styles.split}>
      <View style={styles.main}>{main}{chart}</View>
      <View style={styles.breakdown}>
        {data.breakdown.map(({ label, amount }) => <View key={label} style={styles.breakdownRow}><Text style={styles.meta}>{label}</Text><Text style={styles.breakdownValue}>{amount}</Text></View>)}
      </View>
    </View>
  )
}

function ActiveUsers({ data, size, still }: { data: ActiveUsersData; size: BentoWidgetSize; still: boolean }) {
  const styles = useThemed(createStyles)
  if (size === 'small') {
    return <><View style={styles.push} /><CountUp value={data.value} format={whole} still={still} style={styles.value} /><View style={styles.delta}><Text style={styles.change}>{data.change}</Text><Text style={styles.meta}>{data.shortNote}</Text></View></>
  }
  const days = size === 'medium' ? data.days.slice(0, 7) : data.days
  const top = Math.max(...days.map(({ value }) => value))
  return (
    <>
      <View style={styles.valueRow}>
        <CountUp value={data.value} format={whole} still={still} style={styles.value} />
        <View style={styles.delta}><Text style={styles.change}>{data.change}</Text><Text style={styles.meta}>{data.note}</Text></View>
      </View>
      <View style={styles.push} />
      <View style={[styles.bars, size === 'large' && styles.barsLarge]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {days.map(({ value }, index) => <Bar key={index} value={value} top={top} now={index === days.length - 1} index={index} still={still} />)}
      </View>
      <View style={styles.days} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{days.map(({ label }, index) => <Text key={index} style={styles.dayLabel}>{label}</Text>)}</View>
    </>
  )
}

function Activity({ data, size }: { data: ActivityData; size: BentoWidgetSize }) {
  const styles = useThemed(createStyles)
  const [latest] = data.events
  if (size === 'small') {
    return (
      <>
        <View style={styles.push} />
        <View style={styles.latest}><View style={[styles.dot, styles.dotSolid, styles.dotLatest]} /><Text style={styles.compact}>{latest?.text}</Text></View>
        <Text style={[styles.meta, styles.when]}>{data.latestWhen}</Text>
      </>
    )
  }
  return (
    <>
      <View style={styles.push} />
      <View style={styles.events}>
        {data.events.slice(0, size === 'medium' ? 3 : 4).map(({ text, time }, index) => (
          <View key={text} style={styles.event}><View style={[styles.dot, index === 0 && styles.dotSolid]} /><Text style={[styles.compact, styles.eventText]} numberOfLines={1}>{text}</Text><Text style={styles.time}>{time}</Text></View>
        ))}
      </View>
    </>
  )
}

function Notes({ data, size, animated, still, onItemsChange }: { data: NotesData; size: BentoWidgetSize; animated: boolean; still: boolean; onItemsChange?: ((items: NoteItem[]) => void) | undefined }) {
  const styles = useThemed(createStyles)
  const [items, setItems] = useState(data.items)
  const done = items.filter((item) => item.done).length
  if (size === 'small') {
    return (
      <>
        <View style={styles.push} />
        <Text style={styles.noteTitle}>{data.title}</Text>
        <Text style={styles.meta}>{done} of {items.length} done</Text>
        <Track share={done / items.length} arrives={false} thin label={data.title} still={still} />
      </>
    )
  }
  function toggle(id: string, next: boolean): void {
    const changed = items.map((item) => (item.id === id ? { ...item, done: next } : item))
    setItems(changed)
    onItemsChange?.(changed)
  }
  const shown = size === 'medium' ? (data.featured ?? items.slice(0, 3).map(({ id }) => id)).flatMap((id) => items.filter((item) => item.id === id)) : items
  return (
    <>
      <View style={styles.push} />
      <View style={styles.todos}>
        {shown.map((item) => (
          <Pressable key={item.id} accessibilityRole="checkbox" accessibilityLabel={item.text} aria-checked={item.done} hitSlop={NOTE_SLOP} style={styles.todo} onPress={() => toggle(item.id, !item.done)}>
            <Checkbox decorative checked={item.done} animated={animated} />
            <Text style={[styles.compact, styles.todoText, item.done && styles.todoDone]} numberOfLines={1}>{item.text}</Text>
          </Pressable>
        ))}
      </View>
    </>
  )
}

/** Rows stay tight in the tile, so each reaches past its 20 height into the gaps. */
const NOTE_SLOP = { top: 4, bottom: 4 }

function Uptime({ data, size, still }: { data: UptimeData; size: BentoWidgetSize; still: boolean }) {
  const styles = useThemed(createStyles)
  if (size === 'small') return <><View style={styles.push} /><CountUp value={data.value} format={percent} still={still} style={styles.value} /><Text style={styles.meta}>{data.summary}</Text></>
  const days = size === 'medium' ? 30 : 45
  return (
    <>
      <View style={styles.push} />
      <View style={styles.valueRow}>
        <CountUp value={data.value} format={percent} still={still} style={styles.valueSm} />
        <Text style={styles.meta}>last {days} days</Text>
      </View>
      <View accessible accessibilityRole="image" accessibilityLabel={`${days} days. ${data.incidentNote}`} style={[styles.uptime, size === 'large' && styles.uptimeLarge]}>
        {Array.from({ length: days }, (_, index) => <View key={index} style={[styles.day, index === days - 1 - data.incident && styles.dayIncident]} />)}
      </View>
      {size === 'large' ? <Text style={styles.meta} numberOfLines={2}>{data.incidentNote}</Text> : null}
    </>
  )
}

function Storage({ data, size, still }: { data: StorageData; size: BentoWidgetSize; still: boolean }) {
  const styles = useThemed(createStyles)
  const value = (
    <View style={[styles.valueRow, styles.valueTight]}>
      <CountUp value={data.used} format={gigabytes} still={still} style={styles.valueSm} />
      <Text style={styles.meta}>of {data.total}</Text>
    </View>
  )
  if (size === 'small') return <><View style={styles.push} />{value}<Track share={data.used / data.total} arrives label="Storage used" still={still} /></>
  return (
    <>
      <View style={styles.push} />
      {value}
      <View style={styles.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {data.parts.map(({ label, size: part }, index) => <Segment key={label} share={part / data.total} step={index} />)}
      </View>
      <View style={styles.legend}>
        {data.parts.map(({ label, size: part }, index) => (
          <View key={label} style={styles.key}>
            <View style={[styles.keyDot, index === 0 ? styles.step0 : index === 1 ? styles.step1 : styles.step2]} />
            <Text style={styles.meta}>{label}</Text>
            {size === 'medium' ? null : <Text style={styles.keySize}>{part} GB</Text>}
          </View>
        ))}
      </View>
    </>
  )
}

function WidgetBody(props: BentoWidgetProps & { size: BentoWidgetSize; still: boolean; animated: boolean }) {
  const { size, still, animated } = props
  switch (props.widget) {
    case 'revenue': return <Revenue data={props.data ?? BENTO_DATA.revenue} size={size} still={still} />
    case 'active-users': return <ActiveUsers data={props.data ?? BENTO_DATA['active-users']} size={size} still={still} />
    case 'activity': return <Activity data={props.data ?? BENTO_DATA.activity} size={size} />
    case 'notes': return <Notes data={props.data ?? BENTO_DATA.notes} size={size} animated={animated} still={still} onItemsChange={props.onItemsChange} />
    case 'uptime': return <Uptime data={props.data ?? BENTO_DATA.uptime} size={size} still={still} />
    default: return <Storage data={props.data ?? BENTO_DATA.storage} size={size} still={still} />
  }
}

/** One dashboard tile: six widgets in three sizes, in ink steps, with a grip for moving it. */
export function BentoWidget(props: BentoWidgetProps) {
  const { size = 'small', grip, fill = false, hovered = false, renderIcon, animated = true, style } = props
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [name, icon] = LABEL[props.widget]
  return (
    <Animated.View
      {...(still ? {} : { entering: enter })}
      accessibilityLabel={name}
      style={[styles.widget, styles[size], fill && styles.fillCell, hovered && styles.hovered, style]}
    >
      <View style={styles.top}>
        <View style={styles.label}>{withInk(renderIcon(icon, 14), colors.textSecondary)}<Text style={styles.labelText}>{name}</Text></View>
        <View style={styles.grip}>{grip ?? <BentoGripDots hovered={hovered} />}</View>
      </View>
      <WidgetBody {...props} size={size} still={still} animated={animated} />
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  widget: { backgroundColor: c.surface, borderColor: c.ink5, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[2], height: 168, maxWidth: '100%', overflow: 'hidden', paddingBottom: space[3.5], paddingLeft: space[3.5], paddingRight: space[3], paddingTop: space[3] },
  small: { width: 173 },
  medium: { width: 350 },
  large: { height: 280, width: 350 },
  fillCell: { height: '100%', width: '100%' },
  hovered: { borderColor: c.textTertiary },
  top: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, height: 28, justifyContent: 'space-between' },
  label: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  labelText: type(14, c.textSecondary, '500'),
  grip: { alignItems: 'center', flexShrink: 0, height: 28, justifyContent: 'center', width: 28, zIndex: 2 },
  dots: { gap: space[1], opacity: 0.3 },
  dotsOn: { opacity: 0.7 },
  dotRow: { flexDirection: 'row', gap: space[1] },
  gripDot: { backgroundColor: c.textPrimary, borderRadius: radius.full, height: 3, width: 3 },
  push: { flex: 1, minHeight: 0 },
  gap2: { flex: 1, minHeight: 2 },
  value: { ...type(28, c.textPrimary, '600'), lineHeight: 32 },
  valueSm: { ...type(24, c.textPrimary, '600'), lineHeight: 32 },
  meta: { ...type(12, c.textTertiary), flexShrink: 0 },
  delta: { alignItems: 'baseline', flexDirection: 'row', flexShrink: 0, gap: space[1] },
  change: type(14, c.textPrimary, '500'),
  valueRow: { alignItems: 'baseline', flexDirection: 'row', flexShrink: 0, gap: space[2] },
  valueTight: { gap: space[1.5] },
  spark: { flexShrink: 0, height: SPARK_HEIGHT, width: '100%' },
  split: { flex: 1, gap: space[2], minHeight: 0 },
  main: { flex: 1, gap: space[2], minWidth: 0 },
  breakdown: { gap: space[0.5], justifyContent: 'flex-end', width: '100%' },
  breakdownRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space[1] },
  breakdownValue: type(14, c.textPrimary, '500'),
  bars: { alignItems: 'flex-end', flexDirection: 'row', flexShrink: 0, gap: space[1.5], height: 48 },
  barsLarge: { height: 120 },
  bar: { backgroundColor: c.ink10, borderRadius: radius.sm, flex: 1, minWidth: 0, transformOrigin: 'bottom' },
  barNow: { backgroundColor: c.inverse },
  days: { flexDirection: 'row', flexShrink: 0, gap: space[1.5], height: 10 },
  dayLabel: { ...type(10, c.textTertiary), flex: 1, lineHeight: 10, minWidth: 0, textAlign: 'center' },
  dot: { borderColor: c.textTertiary, borderRadius: radius.full, borderWidth: 1.5, flexShrink: 0, height: 7, width: 7 },
  dotSolid: { backgroundColor: c.inverse, borderWidth: 0 },
  dotLatest: { marginTop: space[1.5] },
  compact: { ...type(14, c.textPrimary), flexShrink: 1, lineHeight: 18 },
  latest: { alignItems: 'flex-start', flexDirection: 'row', flexShrink: 0, gap: space[2.5] },
  when: { paddingLeft: space[4.5] },
  events: { flexShrink: 0, gap: space[2] },
  event: { alignItems: 'center', flexDirection: 'row', gap: space[2.5] },
  eventText: { flex: 1, minWidth: 0 },
  time: { color: c.textTertiary, flexShrink: 0, fontFamily: font.mono, fontSize: 12, lineHeight: 18 },
  noteTitle: { ...type(14, c.textPrimary, '500'), flexShrink: 0 },
  track: { backgroundColor: c.ink8, borderRadius: radius.sm, flexShrink: 0, height: 6, overflow: 'hidden' },
  trackThin: { borderRadius: radius.xs, height: 4 },
  fill: { ...StyleSheet.absoluteFill, backgroundColor: c.inverse, transformOrigin: 'left' },
  todos: { flexShrink: 0, gap: space[1.5] },
  todo: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 20 },
  todoText: { minWidth: 0 },
  todoDone: { color: c.textTertiary, textDecorationLine: 'line-through' },
  uptime: { flexDirection: 'row', flexShrink: 0, gap: space[1], height: 24 },
  uptimeLarge: { height: 40 },
  day: { backgroundColor: c.ink10, borderRadius: radius.xs, flex: 1, minWidth: 0 },
  dayIncident: { backgroundColor: c.warning },
  segments: { backgroundColor: c.ink5, borderRadius: radius.sm, flexDirection: 'row', flexShrink: 0, gap: space[0.5], height: 6, overflow: 'hidden' },
  segment: { borderRadius: radius.sm },
  step0: { backgroundColor: c.inverse },
  step1: { backgroundColor: c.textSecondary },
  step2: { backgroundColor: c.ink10 },
  legend: { columnGap: space[3.5], flexDirection: 'row', flexShrink: 0, flexWrap: 'wrap' },
  key: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  keyDot: { borderRadius: radius.full, flexShrink: 0, height: 7, width: 7 },
  keySize: type(14, c.textPrimary, '500'),
})
