import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, SensorType, runOnJS, useAnimatedReaction, useAnimatedSensor, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Badge } from './badge'
import { Button, withInk } from './button'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'

/** Gauge diameter. */
const SIZE = 168
/** Gauge change: amplitude 9 to 4 over 1200 ms, as a scale on the 4 point wave. */
const SLOSH_SCALE = 9 / 4
const SLOSH_TILT = -3
const SETTLE_MS = 1200
const SETTLE = { duration: SETTLE_MS, dampingRatio: 0.7 } as const
const SWAY = { stiffness: 120, damping: 7 } as const
const DRIFT = { duration: SETTLE_MS, easing: Easing.bezierFn(0, 0, 0.58, 1) }
const COUNT = { duration: SETTLE_MS, easing: Easing.bezierFn(0.23, 1, 0.32, 1) }
const DRIFT_FROM = -84
const MAX_DEVICE_TILT = 6
const DEVICE_TILT_SHARE = 0.2
const SENSOR_MS = 33
const BACK_WAVE_OPACITY = 0.3

const percent = (value: number): string => `${Math.round(value)}%`
const levelOf = (share: number): number => SIZE * (1 - share)

export type LiquidGaugeProps = {
  /** Amount used, in `unit`. */
  used: number
  total: number
  /** Default `GB`. */
  unit?: string
  /** Default `Storage`. */
  label?: string
  /** Default the `hard-drive` icon, through `renderIcon`. */
  icon?: ReactNode
  renderIcon: RenderIcon
  /** Share of `total` where it turns Almost full. Default 0.9. */
  warnAt?: number
  /** Holds the wave at its tilted, tall pose. Changes to `used` slosh on their own. */
  slosh?: boolean
  /** Default `Manage storage`. */
  actionLabel?: string
  /** Default `Free up space`. */
  urgentActionLabel?: string
  onAction?: () => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

// A deep body under the surface, so a tilt or a splash never opens a gap above the fill.
const WAVE = 'M0 12q42-8 84 0t84 0 84 0 84 0 84 0 84 0V160H0Z'

/** Leans the wave with the phone. Mounted only while motion is on, so the sensor stays off otherwise. */
function DeviceTilt({ lean }: { lean: SharedValue<number> }) {
  const rotation = useAnimatedSensor(SensorType.ROTATION, { interval: SENSOR_MS })
  useAnimatedReaction(() => rotation.sensor.value.roll, (roll) => {
    const degrees = roll * 180 / Math.PI * DEVICE_TILT_SHARE
    lean.value = Math.max(-MAX_DEVICE_TILT, Math.min(MAX_DEVICE_TILT, degrees))
  })
  return null
}

function Readout({ value, free, onLiquid = false, full = false }: { value: number; free: string; onLiquid?: boolean; full?: boolean }) {
  const styles = useThemed(createStyles)
  return (
    <>
      <Text style={[styles.percent, onLiquid && styles.onLiquid, onLiquid && full && styles.onDanger]}>{percent(value)}</Text>
      <Text style={[styles.free, onLiquid && styles.onLiquid, onLiquid && full && styles.onDanger]}>{free}</Text>
    </>
  )
}

/** A quota as liquid in a circle. It rises to its level, sloshes and settles. */
export function LiquidGauge({ used, total, unit = 'GB', label = 'Storage', icon, renderIcon, warnAt = 0.9, slosh = false, actionLabel = 'Manage storage', urgentActionLabel = 'Free up space', onAction, animated = true, style }: LiquidGaugeProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const share = total > 0 ? Math.min(used / total, 1) : 0
  const value = share * 100
  const full = share >= warnAt
  const free = `${Math.max(total - used, 0).toFixed(1)} ${unit} free`
  const held = slosh && !still

  const level = useSharedValue(levelOf(share))
  const amplitude = useSharedValue(held ? SLOSH_SCALE : 1)
  const tilt = useSharedValue(held ? SLOSH_TILT : 0)
  const lean = useSharedValue(0)
  const drift = useSharedValue(0)
  const count = useSharedValue(value)
  const [shownPercent, setShownPercent] = useState(value)
  const shown = useRef({ share, slosh })

  useEffect(() => {
    if (still) { level.value = levelOf(share); amplitude.value = 1; tilt.value = 0; lean.value = 0; return }
    if (shown.current.share === share && shown.current.slosh === slosh) return
    shown.current = { share, slosh }
    amplitude.value = SLOSH_SCALE
    tilt.value = SLOSH_TILT
    drift.value = DRIFT_FROM
    level.value = withSpring(levelOf(share), SETTLE)
    amplitude.value = withSpring(slosh ? SLOSH_SCALE : 1, SETTLE)
    tilt.value = withSpring(slosh ? SLOSH_TILT : 0, SWAY)
    drift.value = withTiming(0, DRIFT)
  }, [share, still, slosh, level, amplitude, tilt, lean, drift])

  useEffect(() => {
    count.value = still ? value : withTiming(value, COUNT)
  }, [count, still, value])

  // Rounded, so React renders once per whole percent and not once per frame.
  useAnimatedReaction(() => Math.round(count.value), (next, previous) => { if (next !== previous) runOnJS(setShownPercent)(next) })

  const spoken = useRef(Math.round(value))
  useEffect(() => {
    const whole = Math.round(value)
    if (spoken.current === whole) return
    spoken.current = whole
    AccessibilityInfo.announceForAccessibility(`${whole}% used, ${free}`)
  }, [free, value])

  const levelStyle = useAnimatedStyle(() => ({ transform: [{ translateY: level.value }] }))
  const counterStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -level.value }] }))
  const waveStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drift.value }, { rotate: `${tilt.value + lean.value}deg` }, { scaleY: amplitude.value }] }))
  const liquid = full ? colors.danger : colors.inverse

  return (
    <Card
      animated={animated}
      style={[styles.gaugeCard, style]}
      footerStyle={styles.footer}
      footer={<Button size="sm" variant={full ? 'primary' : 'secondary'} animated={animated} onPress={onAction}>{full ? urgentActionLabel : actionLabel}</Button>}
    >
      {still ? null : <DeviceTilt lean={lean} />}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.tile}>{withInk(icon ?? renderIcon('hard-drive', 14), colors.textSecondary)}</View>
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{label}</Text>
        </View>
        <Badge size="sm" tone={full ? 'warning' : 'success'} animated={animated}>{full ? 'Almost full' : 'Healthy'}</Badge>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${percent(value)}, ${free}`}
        style={styles.gauge}
        onTouchStart={(e) => {
          // A tap splashes the liquid: the wave kicks up toward the tapped side and sways back on a spring.
          if (still || slosh) return
          const side = e.nativeEvent.locationX < SIZE / 2 ? 1 : -1
          amplitude.value = SLOSH_SCALE * 1.2
          tilt.value = side * 6
          drift.value = side * 60
          amplitude.value = withSpring(1, SETTLE)
          tilt.value = withSpring(0, { stiffness: 90, damping: 6 })
          drift.value = withTiming(0, { duration: 1200, easing: Easing.out(Easing.quad) })
        }}
      >
        <View style={styles.readout}><Readout value={shownPercent} free={free} /></View>
        <Animated.View style={[styles.level, levelStyle]}>
          <Animated.View style={[styles.wave, styles.waveBack, waveStyle]}>
            <Svg width={504} height={160} viewBox="0 0 504 160"><Path d={WAVE} fill={colors.textPrimary} opacity={BACK_WAVE_OPACITY} /></Svg>
          </Animated.View>
          <Animated.View style={[styles.wave, waveStyle]}>
            <Svg width={504} height={160} viewBox="0 0 504 160"><Path d={WAVE} fill={liquid} /></Svg>
          </Animated.View>
          <View style={styles.clip}>
            <View style={[styles.fill, full && styles.fillFull]} />
            <Animated.View style={[styles.readout, counterStyle]}><Readout value={shownPercent} free={free} onLiquid full={full} /></Animated.View>
          </View>
        </Animated.View>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statLabel}>Used</Text><Text style={styles.statValue}>{used.toFixed(1)} {unit}</Text></View>
        <View style={[styles.stat, styles.statEnd]}><Text style={styles.statLabel}>Total</Text><Text style={styles.statValue}>{total} {unit}</Text></View>
      </View>
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  gaugeCard: { maxWidth: 358, width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  titleRow: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[2] },
  tile: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.field, flexShrink: 0, height: 28, justifyContent: 'center', width: 28 },
  title: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  gauge: { alignSelf: 'center', backgroundColor: c.ink5, borderRadius: radius.full, height: SIZE, overflow: 'hidden', width: SIZE },
  // Its top edge is the liquid surface.
  level: { height: SIZE, left: 0, position: 'absolute', top: 0, width: '100%' },
  wave: { height: 160, left: -SIZE, position: 'absolute', top: -12, transformOrigin: '50% 12px', width: 504 },
  waveBack: { top: -17 },
  clip: { height: SIZE, left: 0, overflow: 'hidden', position: 'absolute', top: 0, width: '100%' },
  fill: { backgroundColor: c.inverse, bottom: 0, left: 0, position: 'absolute', right: 0, top: 100 },
  fillFull: { backgroundColor: c.danger },
  // The same readout twice: ink behind the liquid, and clipped to the liquid on top of it.
  readout: { alignItems: 'center', left: 0, position: 'absolute', top: 54, width: '100%' },
  percent: { ...type(36, c.textPrimary, '600'), lineHeight: 44 },
  free: { ...type(12, c.textPrimary), opacity: 0.6 },
  onLiquid: { color: c.textInverse },
  onDanger: { color: c.onSolid },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { gap: space[0.5] },
  statEnd: { alignItems: 'flex-end' },
  statLabel: type(12, c.textTertiary),
  statValue: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  footer: { paddingBottom: space[1], paddingHorizontal: space[1], paddingTop: space[2] },
})
