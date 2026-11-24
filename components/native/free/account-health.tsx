import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Button, withInk } from './button'
import { EASE_STANDARD, ROW_MS, panelEnter, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { RollingText } from './label'
import { useCompact } from './popover'
import { Skeleton } from './skeleton'
import { Spinner } from './spinner'
import { ToggleGroup } from './toggle-group'
import { Meter, Tween } from './usage-meter'

/** From the 181 Motion frame: updates 240 ms on motion/ease-standard. */
const UPDATE = { duration: ROW_MS, easing: EASE_STANDARD }
const SPARK_WIDTH = 60
const SPARK_HEIGHT = 16
const GAUGE_RADIUS = 43
const GAUGE_ARC = `M 5 53 A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 91 53`
/** The half circle, in points. */
const GAUGE_LENGTH = Math.PI * GAUGE_RADIUS

const AnimatedPath = Animated.createAnimatedComponent(Path)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export type HealthStatus = 'good' | 'watch' | 'risk'

const STATUS: Record<HealthStatus, { label: string; icon: string }> = {
  risk: { label: 'At risk', icon: 'alert-02' },
  watch: { label: 'Watch', icon: 'alert-circle' },
  good: { label: 'Good', icon: 'check' },
}

/** The usual signal icon names, for `renderIcon`. */
export const HEALTH_ICONS = { usage: 'chart-bar-line', seats: 'user', tickets: 'ticket', nps: 'message', invoice: 'receipt' } as const

export type HealthSignal = {
  id: string
  title: string
  detail: string
  /** Any short value, like `61%` or `14 open`. */
  value: string
  status: HealthStatus
  /** Oldest first. Any scale. */
  trend: number[]
  icon?: ReactNode
}

export type HealthSnapshot = {
  /** 0 to 100. */
  score: number
  scoreStatus: HealthStatus
  scoreLabel: string
  scoreNote: string
  signals: HealthSignal[]
  summary: string
}

export type AccountHealthProps = {
  account: string
  plan: string
  /** Period label to its numbers, like `30d`. The first is the default. */
  periods: Record<string, HealthSnapshot>
  period?: string
  onPeriodChange?: (period: string) => void
  renewalLabel: string
  /** Days to renewal. */
  daysLeft: number
  /** The length of the term in days, for the bar. Default 365. */
  termDays?: number
  logo?: ReactNode
  /** The model name beside the summary. Hidden on phones. */
  model?: string
  /** The summary shows as a skeleton while this is true. */
  loading?: boolean
  /** Adds the refresh Icon Button. */
  onRefresh?: () => void
  actionTitle: string
  actionDetail: string
  actionLabel: string
  onAction?: () => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const whole = (value: number): string => String(Math.round(value))

function sparkPoints(points: number[]): number[] {
  const low = Math.min(...points)
  const span = Math.max(...points) - low || 1
  return points.flatMap((point, index) => [(index / Math.max(points.length - 1, 1)) * SPARK_WIDTH, SPARK_HEIGHT - ((point - low) / span) * SPARK_HEIGHT + 2])
}

/** Blends one point list into another. Lists of different lengths swap at once. */
const blend = (from: number[], to: number[], progress: number): number[] => {
  'worklet'
  return from.length === to.length ? to.map((value, index) => (from[index] ?? value) + (value - (from[index] ?? value)) * progress) : to
}

const toPath = (points: number[]): string => {
  'worklet'
  let path = ''
  for (let index = 0; index < points.length; index += 2) path += `${index ? 'L' : 'M'} ${(points[index] ?? 0).toFixed(1)} ${(points[index + 1] ?? 0).toFixed(1)} `
  return path
}

const statusColor = (c: Colors, status: HealthStatus, good: string): string => (status === 'risk' ? c.danger : status === 'watch' ? c.warning : good)

function Spark({ points, status, still }: { points: number[]; status: HealthStatus; still: boolean }) {
  const colors = useColors()
  const target = sparkPoints(points)
  const key = target.join(',')
  const from = useSharedValue(target)
  const to = useSharedValue(target)
  const progress = useSharedValue(1)
  const current = useRef(target)

  useEffect(() => {
    const next = key.split(',').map(Number)
    from.value = current.current
    to.value = next
    current.current = next
    progress.value = 0
    progress.value = still ? 1 : withTiming(1, UPDATE)
  }, [from, key, progress, still, to])

  const lineProps = useAnimatedProps(() => ({ d: toPath(blend(from.value, to.value, progress.value)) }))
  const dotProps = useAnimatedProps(() => {
    const at = blend(from.value, to.value, progress.value)
    return { cx: at[at.length - 2] ?? 0, cy: at[at.length - 1] ?? 0 }
  })
  const color = statusColor(colors, status, colors.textSecondary)
  return (
    <Svg width={64} height={20} viewBox="-1 -1 66 22" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <AnimatedPath animatedProps={lineProps} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <AnimatedCircle animatedProps={dotProps} r={3} fill={color} />
    </Svg>
  )
}

function Gauge({ score, status, still, animated }: { score: number; status: HealthStatus; still: boolean; animated: boolean }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const shown = useSharedValue(score / 100)
  useEffect(() => {
    shown.value = still ? score / 100 : withTiming(score / 100, UPDATE)
  }, [score, shown, still])
  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: GAUGE_LENGTH * (1 - shown.value) }))
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Health score ${score} of 100`} style={styles.gauge}>
      <Svg width={96} height={58} viewBox="0 0 96 58" style={styles.gaugeArc}>
        <Path d={GAUGE_ARC} fill="none" stroke={colors.ink8} strokeWidth={10} strokeLinecap="round" />
        <AnimatedPath animatedProps={arcProps} d={GAUGE_ARC} fill="none" stroke={statusColor(colors, status, colors.success)} strokeWidth={10} strokeLinecap="round" strokeDasharray={[GAUGE_LENGTH, GAUGE_LENGTH]} />
      </Svg>
      <Tween value={score} format={whole} animated={animated} style={styles.score} />
    </View>
  )
}

/** Customer health: a score gauge, renewal, signals with sparklines, a risk summary and the next step. */
export function AccountHealth({ account, plan, periods, period, onPeriodChange, renewalLabel, daysLeft, termDays = 365, logo, model, loading = false, onRefresh, actionTitle, actionDetail, actionLabel, onAction, renderIcon, animated = true, style }: AccountHealthProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const compact = useCompact()
  const labels = Object.keys(periods)
  const [held, setHeld] = useState(labels[0] ?? '')
  const current = period ?? held
  const data = periods[current] ?? Object.values(periods)[0]
  if (!data) return null
  const used = 1 - Math.min(daysLeft / termDays, 1)
  const stateColor = statusColor(colors, data.scoreStatus, colors.success)

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} style={[styles.tray, style]}>
      <View style={styles.body}>
        <View style={styles.header}>
          <View style={styles.logo}>{withInk(logo ?? renderIcon('zap', 16), colors.textInverse)}</View>
          <View style={styles.names}>
            <Text style={styles.account} accessibilityRole="header" numberOfLines={1}>{account}</Text>
            <Text style={styles.small}>{plan}</Text>
          </View>
          <ToggleGroup
            type="single"
            label="Period"
            items={labels.map((value) => ({ value, label: value }))}
            value={current}
            animated={animated}
            onValueChange={(next) => { if (!next) return; setHeld(next); onPeriodChange?.(next) }}
          />
        </View>

        <View style={[styles.scoreRow, compact && styles.scoreColumn]}>
          <View style={styles.health}>
            <Gauge score={data.score} status={data.scoreStatus} still={still} animated={animated} />
            <View style={styles.healthText}>
              <View style={styles.stateLabel}>{withInk(renderIcon(STATUS[data.scoreStatus].icon, 12), stateColor)}<Text style={styles.stateText}>{data.scoreLabel}</Text></View>
              <View style={styles.trend}>{withInk(renderIcon('trending-down', 12), colors.textSecondary)}<Text style={styles.small}>{data.scoreNote}</Text></View>
            </View>
          </View>
          {compact ? null : <View style={styles.vrule} />}
          <View style={[styles.renewal, compact && styles.renewalStacked]}>
            <Text style={styles.small}>{renewalLabel}</Text>
            <Meter value={used} height={4} ms={ROW_MS} label={`${daysLeft} days left of ${termDays}`} animated={animated} />
            <View style={styles.days}>
              <Tween value={daysLeft} format={whole} animated={animated} style={styles.daysValue} />
              <Text style={styles.small}>days left</Text>
            </View>
          </View>
        </View>

        <View style={styles.signals}>
          {data.signals.map((signal, index) => (
            <Animated.View key={signal.id} {...(still ? {} : { entering: rowEnter(index) })} style={styles.signal}>
              {signal.icon ? <View style={styles.signalIcon}>{withInk(signal.icon, colors.textTertiary)}</View> : null}
              <View style={styles.signalText}><Text style={styles.signalTitle}>{signal.title}</Text><Text style={styles.small}>{signal.detail}</Text></View>
              {compact ? null : <Spark points={signal.trend} status={signal.status} still={still} />}
              <View style={compact ? undefined : styles.signalValue}><RollingText value={signal.value.replaceAll(' ', ' ')} still={still} style={styles.signalTitle} /></View>
              <View style={styles.status}>
                {withInk(renderIcon(STATUS[signal.status].icon, 12), statusColor(colors, signal.status, colors.success))}
                <Text style={[styles.statusText, signal.status === 'risk' ? styles.statusRisk : signal.status === 'watch' ? styles.statusWatch : styles.statusGood]}>{STATUS[signal.status].label}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <View aria-busy={loading} style={styles.summary}>
          <View style={styles.summaryHead}>
            {withInk(renderIcon('sparkles', 16), colors.textSecondary)}
            <Text style={[styles.signalTitle, styles.summaryTitle]} accessibilityRole="header">Risk summary</Text>
            {model && !compact ? <Text style={styles.model}>{model}</Text> : null}
            {loading ? <View style={styles.refreshSlot}><Spinner size="s" label="Refreshing the summary" animated={animated} /></View>
              : onRefresh ? <IconButton variant="ghost" size="sm" icon={renderIcon('refresh-cw', 16)} label="Refresh the summary" animated={animated} onPress={onRefresh} /> : null}
          </View>
          {loading ? (
            <View style={styles.skeleton}><Skeleton height={12} animated={!still} /><Skeleton height={12} animated={!still} /><Skeleton height={12} width="62%" animated={!still} /></View>
          ) : <Text style={styles.summaryText}>{data.summary}</Text>}
        </View>

        <View style={[styles.action, compact && styles.actionStacked]}>
          <View style={[styles.actionText, compact && styles.actionTextStacked]}><Text style={styles.signalTitle}>{actionTitle}</Text><Text style={styles.small}>{actionDetail}</Text></View>
          <Button shape="pill" animated={animated} onPress={onAction}>{actionLabel}</Button>
        </View>
      </View>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.frame, maxWidth: 580, padding: space[1], width: '100%' },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: StyleSheet.hairlineWidth },
  small: type(12, c.textSecondary),
  header: { alignItems: 'center', flexDirection: 'row', gap: space[3], paddingBottom: space[3], paddingHorizontal: space[4], paddingTop: space[4] },
  logo: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.field, flexShrink: 0, height: 32, justifyContent: 'center', width: 32 },
  names: { flex: 1, minWidth: 0 },
  account: { ...type(16, c.textPrimary, '500'), lineHeight: 20 },
  scoreRow: { alignItems: 'center', borderBottomColor: c.ink8, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: space[5], paddingBottom: space[4], paddingHorizontal: space[4], paddingTop: space[1] },
  scoreColumn: { alignItems: 'stretch', flexDirection: 'column', gap: space[3] },
  health: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[4], minWidth: 0 },
  gauge: { flexShrink: 0, height: 64, width: 112 },
  gaugeArc: { left: space[2], position: 'absolute', top: 0 },
  score: { ...type(28, c.textPrimary, '500'), bottom: 0, left: 0, lineHeight: 36, position: 'absolute', right: 0, textAlign: 'center' },
  healthText: { flexShrink: 1, gap: space[1], minWidth: 0 },
  stateLabel: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  stateText: type(14, c.textPrimary, '500'),
  trend: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  vrule: { alignSelf: 'stretch', backgroundColor: c.ink8, flexShrink: 0, width: StyleSheet.hairlineWidth },
  renewal: { flexShrink: 0, gap: space[1.5], width: 200 },
  renewalStacked: { borderTopColor: c.ink8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space[3], width: 'auto' },
  days: { alignItems: 'baseline', flexDirection: 'row', gap: space[1.5] },
  daysValue: { ...type(24, c.textPrimary, '500'), fontVariant: ['tabular-nums'], lineHeight: 32 },
  signals: { borderBottomColor: c.ink8, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space[1] },
  signal: { alignItems: 'center', flexDirection: 'row', gap: space[3], minHeight: 56, paddingHorizontal: space[4], paddingVertical: space[2.5] },
  signalIcon: { flexShrink: 0, width: 16 },
  signalText: { flex: 1, minWidth: 0 },
  signalTitle: type(14, c.textPrimary, '500'),
  signalValue: { flexShrink: 0, width: 56 },
  status: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: space[1], width: 72 },
  statusText: type(12, c.textSecondary),
  statusRisk: { color: c.danger },
  statusWatch: { color: c.warning },
  statusGood: { color: c.success },
  summary: { borderBottomColor: c.ink8, borderBottomWidth: StyleSheet.hairlineWidth, gap: space[2], padding: space[4] },
  summaryHead: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 28 },
  summaryTitle: { flex: 1 },
  model: type(12, c.textTertiary),
  refreshSlot: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  summaryText: { ...type(14, c.textSecondary), lineHeight: 22 },
  skeleton: { gap: space[2] },
  action: { alignItems: 'center', flexDirection: 'row', gap: space[3], padding: space[4] },
  actionStacked: { alignItems: 'flex-start', flexDirection: 'column' },
  actionText: { flex: 1, minWidth: 0 },
  actionTextStacked: { flex: 0 },
})
