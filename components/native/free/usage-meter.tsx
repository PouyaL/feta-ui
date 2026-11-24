import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { EASE_STANDARD, ROW_MS, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'

export type MeterTone = 'neutral' | 'warning' | 'danger'
const WARNING_AT = 0.8
const FILL_MS = 400
const plain = (value: number): string => Math.round(value).toLocaleString('en-US')
/** A worklet: Marker's animated style calls it on the UI thread. */
const clamp = (n: number): number => {
  'worklet'
  return Math.min(1, Math.max(0, n))
}

export type TweenProps = { value: number; format?: (value: number) => string; animated?: boolean; style?: StyleProp<TextStyle> }

/**
 * A number that tweens on the UI thread, each frame's text landing in state. setNativeProps text is not reliable on
 * the New Architecture or available on web, and a tween is short.
 */
export function Tween({ value, format = String, animated = true, style }: TweenProps) {
  const still = useStill(animated)
  const shown = useSharedValue(value)
  const [text, setText] = useState(() => format(value))
  const shownText = useRef(text)
  const formatRef = useRef(format)
  formatRef.current = format
  const write = (latest: number): void => {
    const next = formatRef.current(latest)
    if (next !== shownText.current) { shownText.current = next; setText(next) }
  }
  useAnimatedReaction(() => shown.value, (latest, previous) => { if (latest !== previous) runOnJS(write)(latest) })
  useEffect(() => {
    shown.value = still ? value : withTiming(value, { duration: ROW_MS, easing: EASE_STANDARD })
  }, [value, still, shown])
  return <TextInput editable={false} scrollEnabled={false} value={text} accessibilityLabel={format(value)} style={[tweenReset, style]} />
}

const tweenReset: TextStyle = { padding: 0 }

export type MeterProps = { value: number; tone?: MeterTone; label?: string; height?: number; markers?: number[]; ms?: number; animated?: boolean; style?: StyleProp<ViewStyle> }

/** A track filled by transform. `value` and `markers` run 0 to 1. */
export function Meter({ value, tone = 'neutral', label, height = 8, markers, ms = ROW_MS, animated = true, style }: MeterProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const progress = useSharedValue(clamp(value))
  const width = useSharedValue(0)
  useEffect(() => {
    progress.value = still ? clamp(value) : withTiming(clamp(value), { duration: ms, easing: EASE_STANDARD })
  }, [value, still, ms, progress])
  const fill = useAnimatedStyle(() => ({ height, transform: [{ translateX: (progress.value - 1) * width.value }] }))
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(value * 100)}
      onLayout={(event) => { width.value = event.nativeEvent.layout.width }}
      style={[styles.track, style]}
    >
      <Animated.View style={[styles.fill, tone === 'warning' && styles.warning, tone === 'danger' && styles.danger, fill]} />
      {markers?.map((at) => <Marker key={at} at={at} width={width} height={height} />)}
    </View>
  )
}

function Marker({ at, width, height }: { at: number; width: { value: number }; height: number }) {
  const styles = useThemed(createStyles)
  const place = useAnimatedStyle(() => ({ height, transform: [{ translateX: clamp(at) * width.value }] }))
  return <Animated.View style={[styles.marker, place]} />
}

export type UsageMeterProps = {
  metric: string
  used: number
  limit: number
  /** A word after the numbers, like GB. */
  unit?: string
  hint?: ReactNode
  /** Shown top right while Normal, like Resets Nov 1. */
  meta?: ReactNode
  /** Default the `zap` icon, through `renderIcon`. */
  icon?: ReactNode
  renderIcon?: RenderIcon
  format?: (value: number) => string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A metric against its limit. State comes from the numbers: Warning at 80%, Over limit past 100%. */
export function UsageMeter({ metric, used, limit, unit, hint, meta, icon, renderIcon, format = plain, animated = true, style }: UsageMeterProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const ratio = limit > 0 ? used / limit : 0
  const over = ratio > 1
  const warning = !over && ratio >= WARNING_AT
  return (
    <Animated.View {...(still ? {} : { entering: rowEnter() })} style={[styles.meter, style]}>
      <View style={styles.top}>
        <View style={styles.metric}>{icon ?? renderIcon?.('zap', 16)}<Text style={styles.name}>{metric}</Text></View>
        {over ? <Badge size="sm" tone="danger" mark>Over limit</Badge> : warning ? <Badge size="sm" tone="warning" mark>{`${Math.round(ratio * 100)}% used`}</Badge> : meta ? <Text style={styles.small}>{meta}</Text> : null}
      </View>
      <View style={styles.numbers}>
        <Tween value={used} format={format} animated={animated} style={styles.used} />
        <Text style={styles.small}>of {format(limit)}{unit ? ` ${unit}` : ''}</Text>
      </View>
      <Meter value={ratio} tone={over ? 'danger' : warning ? 'warning' : 'neutral'} label={`${metric} used`} ms={FILL_MS} animated={animated} />
      {hint ? <Text style={styles.small}>{hint}</Text> : null}
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  track: { backgroundColor: c.ink5, borderRadius: radius.full, overflow: 'hidden' },
  fill: { backgroundColor: c.inverse, borderRadius: radius.full, width: '100%' },
  // kit.ts has no warning color yet, so Warning borrows danger. The Badge and icon carry the difference.
  warning: { backgroundColor: c.danger, opacity: 0.7 },
  danger: { backgroundColor: c.danger },
  marker: { backgroundColor: c.surface, left: 0, position: 'absolute', top: 0, width: 2 },
  meter: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[2], padding: space[4] },
  top: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  metric: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[1.5] },
  name: type(14, c.textPrimary, '500'),
  numbers: { alignItems: 'baseline', flexDirection: 'row', gap: space[1] },
  used: type(24, c.textPrimary, '500'),
  small: type(12, c.textSecondary),
})
