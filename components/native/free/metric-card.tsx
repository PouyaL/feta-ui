import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Line, Path } from 'react-native-svg'
import { pressedState, radius, space, useColors, type Colors } from '../kit'
import { Badge } from './badge'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { RollingText } from './label'
import { Separator } from './separator'
import { ToggleGroup } from './toggle-group'

const CHART_HEIGHT = 128
/** Room for the end dot. */
const RIGHT_INSET = 4
const TOP = 10
const BOTTOM = 118
/** Every period resamples to this many points, so the paths can morph. */
const POINTS = 30
/** Line and arcs draw in: 600 ms. Period morph: 400 ms. */
const DRAW_MS = 600
const MORPH_MS = 400
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const AnimatedPath = Animated.createAnimatedComponent(Path)

export type MetricSegment = { name: string; value: number }
export type MetricEvent = {
  /** Index into `current`. */
  index: number
  label: string
}
export type MetricPeriod = {
  /** Like `30D`. */
  label: string
  /** The headline number. */
  value: number
  /** Percent change, like 6.8. */
  delta: number
  /** Like `vs previous 30 days`. */
  compare: string
  current: number[]
  previous: number[]
  /** One label per day, like `Sat, Oct 3`. */
  labels: string[]
  /** Axis start and end. */
  from: string
  to: string
  events?: MetricEvent[]
  segments: MetricSegment[]
}

export type MetricCardProps = {
  title?: ReactNode
  periods: MetricPeriod[]
  /** The period label. Controlled when set. */
  period?: string
  defaultPeriod?: string
  onPeriodChange?: (period: string) => void
  /** Starts on this day index, as if pointed at. */
  defaultDay?: number | null
  /** Starts with this segment focused. */
  defaultSegment?: string | null
  format?: (value: number) => string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const dollars = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`

function resample(values: number[]): number[] {
  return Array.from({ length: POINTS }, (_, i) => {
    const at = (i / (POINTS - 1)) * (values.length - 1)
    const low = Math.floor(at)
    const a = values[low] ?? 0
    return a + ((values[Math.min(low + 1, values.length - 1)] ?? a) - a) * (at - low)
  })
}

/** Builds the path string on the UI thread, between the last shape and the next. */
const morphPath = (from: number[], to: number[], t: number, plot: number): string => {
  'worklet'
  let d = ''
  for (let i = 0; i < POINTS; i += 1) {
    const a = from[i] ?? 0
    const y = a + ((to[i] ?? a) - a) * t
    d += `${i ? 'L' : 'M'}${(i / (POINTS - 1)) * plot} ${y} `
  }
  return d
}

/** One number with its trend: a period switch, a line over an area, and a share breakdown. */
export function MetricCard({ title = 'Revenue', periods, period, defaultPeriod, onPeriodChange, defaultDay = null, defaultSegment = null, format = dollars, renderIcon, animated = true, style }: MetricCardProps) {
  const styles = useThemed(createStyles)
  const c = useColors()
  const still = useStill(animated)
  const [heldPeriod, setHeldPeriod] = useState(defaultPeriod ?? periods[0]?.label ?? '')
  const [day, setDay] = useState<number | null>(defaultDay)
  const [segment, setSegment] = useState<string | null>(defaultSegment)
  const [width, setWidth] = useState(0)
  const active = periods.find((item) => item.label === (period ?? heldPeriod)) ?? periods[0]

  const shape = useMemo(() => {
    if (!active) return null
    const all = [...active.current, ...active.previous]
    const low = Math.min(...all)
    const span = Math.max(...all) - low || 1
    const y = (value: number): number => BOTTOM - ((value - low) / span) * (BOTTOM - TOP)
    return { y, line: resample(active.current).map(y), previous: resample(active.previous).map(y) }
  }, [active])

  const plot = Math.max(0, width - RIGHT_INSET)
  const lineFrom = useSharedValue(shape?.line ?? [])
  const lineTo = useSharedValue(shape?.line ?? [])
  const prevFrom = useSharedValue(shape?.previous ?? [])
  const prevTo = useSharedValue(shape?.previous ?? [])
  const morph = useSharedValue(1)
  const plotWidth = useSharedValue(0)
  const reveal = useSharedValue(still ? 1 : 0)
  const shown = useRef(shape)

  useEffect(() => {
    plotWidth.value = plot
    if (plot > 0) reveal.value = still ? 1 : withTiming(1, { duration: DRAW_MS, easing: EASE_OUT })
  }, [plot, still, plotWidth, reveal])

  useEffect(() => {
    if (!shape || shape === shown.current) return
    lineFrom.value = shown.current?.line ?? shape.line
    prevFrom.value = shown.current?.previous ?? shape.previous
    lineTo.value = shape.line
    prevTo.value = shape.previous
    shown.current = shape
    morph.value = 0
    morph.value = still ? 1 : withTiming(1, { duration: MORPH_MS, easing: EASE_OUT })
  }, [shape, still, lineFrom, lineTo, prevFrom, prevTo, morph])

  const lineProps = useAnimatedProps(() => ({ d: morphPath(lineFrom.value, lineTo.value, morph.value, plotWidth.value) }))
  const prevProps = useAnimatedProps(() => ({ d: morphPath(prevFrom.value, prevTo.value, morph.value, plotWidth.value) }))
  const areaProps = useAnimatedProps(() => ({ d: `${morphPath(lineFrom.value, lineTo.value, morph.value, plotWidth.value)}L${plotWidth.value} ${CHART_HEIGHT} L0 ${CHART_HEIGHT} Z` }))
  const clip = useAnimatedStyle(() => ({ width: reveal.value * (plotWidth.value + RIGHT_INSET) }))

  if (!active || !shape) return null

  const count = active.current.length
  const dayValue = day === null ? undefined : active.current[day]
  const average = active.current.reduce((all, value) => all + value, 0) / count
  const gap = dayValue === undefined ? 0 : Math.round(((dayValue - average) / average) * 100)
  const sum = active.segments.reduce((all, item) => all + item.value, 0)
  const x = (index: number): number => (index / (count - 1)) * plot
  const dayText = `${active.labels[day ?? 0] ?? ''} · ${gap === 0 ? 'at' : `${Math.abs(gap)}% ${gap > 0 ? 'above' : 'below'}`} the daily average`
  const up = active.delta >= 0

  function changePeriod(next: string): void {
    setHeldPeriod(next)
    setDay(null)
    onPeriodChange?.(next)
  }

  function pick(pointX: number): void {
    if (plot > 0) setDay(Math.round(Math.min(1, Math.max(0, pointX / plot)) * (count - 1)))
  }

  const scrub = Gesture.Pan().activeOffsetX([-6, 6]).failOffsetY([-12, 12])
    .onUpdate((event) => { runOnJS(pick)(event.x) })
    .onFinalize(() => { runOnJS(setDay)(null) })
  const tap = Gesture.Tap().onEnd((event) => { runOnJS(pick)(event.x) })

  return (
    <Card animated={animated} style={style}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <ToggleGroup type="single" label="Period" items={periods.map(({ label }) => ({ value: label, label }))} value={active.label} onValueChange={changePeriod} animated={animated} />
      </View>
      <RollingText value={format(dayValue ?? active.value)} still={still} style={styles.number} />
      <View style={styles.delta}>
        {dayValue === undefined ? (
          <>
            <Badge size="sm" tone={up ? 'success' : 'danger'} {...(renderIcon ? { icon: renderIcon(up ? 'trending-up' : 'trending-down', 12) } : {})} animated={animated}>{Math.abs(active.delta)}%</Badge>
            <Text style={styles.meta}>{active.compare}</Text>
          </>
        ) : <Text style={styles.meta}>{dayText}</Text>}
      </View>
      <GestureDetector gesture={Gesture.Race(scrub, tap)}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${typeof title === 'string' ? title : 'Value'} by day`}
          aria-valuetext={`${active.labels[day ?? count - 1] ?? ''}: ${format(dayValue ?? active.current[count - 1] ?? 0)}`}
          aria-valuemin={0}
          aria-valuemax={Math.max(0, count - 1)}
          aria-valuenow={day ?? count - 1}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={({ nativeEvent }) => setDay(Math.min(count - 1, Math.max(0, (day ?? count - 1) + (nativeEvent.actionName === 'increment' ? 1 : -1))))}
          onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
          style={styles.chart}
        >
          <Animated.View style={[styles.clip, clip]}>
            {width > 0 ? (
              <Svg aria-hidden width={width} height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`}>
                <AnimatedPath animatedProps={areaProps} fill={c.textPrimary} fillOpacity={0.05} />
                <AnimatedPath animatedProps={prevProps} fill="none" stroke={c.textTertiary} strokeDasharray="4 4" />
                {active.events?.map((item) => <Line key={item.label} x1={x(item.index)} x2={x(item.index)} y1={0} y2={CHART_HEIGHT} stroke={c.textTertiary} strokeDasharray="2 3" />)}
                <AnimatedPath animatedProps={lineProps} fill="none" stroke={c.textPrimary} strokeWidth={2} />
                {active.events?.map((item) => <Circle key={item.label} cx={x(item.index)} cy={shape.y(active.current[item.index] ?? 0)} r={3} fill={c.surface} stroke={c.textPrimary} strokeWidth={1.5} />)}
                <Circle cx={x(count - 1)} cy={shape.y(active.current[count - 1] ?? 0)} r={4} fill={c.textPrimary} />
                {day !== null ? <><Line x1={x(day)} x2={x(day)} y1={0} y2={CHART_HEIGHT} stroke={c.ink10} /><Circle cx={x(day)} cy={shape.y(dayValue ?? 0)} r={5} fill={c.surface} stroke={c.textPrimary} strokeWidth={2} /></> : null}
              </Svg>
            ) : null}
          </Animated.View>
        </View>
      </GestureDetector>
      <View style={styles.axis}><Text style={styles.meta}>{active.from}</Text><View style={styles.key}><View style={styles.dash} /><Text style={styles.meta}>Previous period</Text></View><Text style={styles.meta}>{active.to}</Text></View>
      <Separator animated={animated} />
      <View style={styles.share}>{active.segments.map(({ name, value: share }, i) => <View key={name} style={[styles.part, i === 0 ? styles.solid : i === 1 ? styles.mid : styles.soft, segment !== null && name !== segment && styles.dim, { flexGrow: share }]} />)}</View>
      {active.segments.map((item, i) => {
        const on = item.name === segment
        return (
          <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={`${item.name}, ${format(item.value)}, ${Math.round((item.value / sum) * 100)}%`} {...pressedState(on)} onPress={() => setSegment(on ? null : item.name)} style={[styles.row, on && styles.rowOn]}>
            <View style={[styles.dot, i === 0 ? styles.solid : i === 1 ? styles.mid : styles.soft]} />
            <Text style={styles.rowName}>{item.name}</Text>
            <RollingText value={format(item.value)} still={still} style={styles.rowValue} />
            <Text style={styles.rowShare}>{Math.round((item.value / sum) * 100)}%</Text>
          </Pressable>
        )
      })}
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  // The web's mobile rules: a secondary 14 title, a 32/38 semibold number, rows with 16/22 values and mono shares.
  title: { ...type(14, c.textSecondary, '500'), lineHeight: 18 },
  number: { ...type(32, c.textPrimary, '600'), lineHeight: 38 },
  delta: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 24 },
  meta: type(12, c.textSecondary),
  chart: { height: CHART_HEIGHT },
  clip: { height: CHART_HEIGHT, overflow: 'hidden' },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  key: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  dash: { backgroundColor: c.ink10, borderRadius: radius.xs, height: 2, width: 12 },
  share: { borderRadius: radius.full, flexDirection: 'row', gap: 2, height: 8, overflow: 'hidden' },
  part: { flexBasis: 0, height: 8 },
  solid: { backgroundColor: c.inverse },
  mid: { backgroundColor: c.canvas === '#ffffff' ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' },
  soft: { backgroundColor: c.ink10 },
  dim: { opacity: 0.4 },
  row: { alignItems: 'center', borderRadius: radius.field, flexDirection: 'row', gap: space[2.5], minHeight: 34, paddingHorizontal: space[2], paddingVertical: space[1.5] },
  rowOn: { backgroundColor: c.ink5 },
  rowShare: { ...type(12, c.textTertiary, '400', true), textAlign: 'right', width: 36 },
  dot: { borderRadius: radius.full, height: 8, width: 8 },
  rowName: { ...type(14, c.textSecondary), flex: 1, minWidth: 0 },
  rowValue: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
})
