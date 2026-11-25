import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, LayoutAnimationConfig, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Line, Path, Rect } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Badge, type BadgeTone } from './badge'
import { withInk } from './button'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'

const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const BASE_MS = 200
const CLOSE_MS = 120
const BASE = { duration: BASE_MS, easing: EASE_OUT }
const swapIn = FadeIn.duration(BASE_MS).easing(EASE_OUT)
const swapOut = FadeOut.duration(BASE_MS).easing(EASE_OUT)
const STAMP = { stiffness: 500, damping: 22 } as const
/** A new status lands: scale 0.6 and clear to full, on `spring.stamp`. */
export const stampIn = () => {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ scale: 0.6 }] },
    animations: { opacity: withSpring(1, STAMP), transform: [{ scale: withSpring(1, STAMP) }] },
  }
}
const stampOut = FadeOut.duration(CLOSE_MS)

/** Notch centres sit 88 up from the bottom and 4 in from each side. */
const NOTCH_RADIUS = 8
const NOTCH_INSET = 4
const NOTCH_RISE = 88
/** The barcode's drawing width. */
const CODE_WIDTH = 204

export type PassStatus = 'on-time' | 'gate-change' | 'delayed' | 'boarding'

export type Flight = {
  airline: string
  flight: string
  from: { code: string; city: string; time: string }
  to: { code: string; city: string; time: string }
  gate: string
  boards: string
  seat: string
  group: string
  passenger: string
  date: string
  /** One line under the fields. */
  note: string
}

type Field = 'gate' | 'boards' | 'seat' | 'group'

/** What a status changes: new values, the Badge label and the field shown in the chip. */
export type StatusPatch = Partial<Flight> & { label?: string; changed?: Field }

export type BoardingPassProps = {
  /** Updates in place. Default `on-time`. */
  status?: PassStatus
  flight?: Flight
  /** Replaces the values each status changes. */
  patches?: Partial<Record<PassStatus, StatusPatch>>
  /** A logo in the 24 mark. Default the `plane` icon, through `renderIcon`. */
  mark?: ReactNode
  renderIcon: RenderIcon
  /** `false` turns off the Badge pop and the crossfade. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const FLIGHT: Flight = {
  airline: 'Northwind', flight: 'NW 214',
  from: { code: 'LIS', city: 'Lisbon', time: '10:40' },
  to: { code: 'CPH', city: 'Copenhagen', time: '15:05' },
  gate: 'B12', boards: '10:05', seat: '14A', group: '2',
  passenger: 'Maya Chen', date: 'Thu, 12 Nov', note: 'Thu, 12 Nov · Doors close 15 min before departure',
}

const PATCHES: Record<PassStatus, StatusPatch> = {
  'on-time': { label: 'On time' },
  'gate-change': { label: 'Gate change', changed: 'gate', gate: 'B31', note: 'Gate moved to B31, 6 min walk from security' },
  delayed: { label: 'Delayed 25 min', changed: 'boards', boards: '10:30', from: { ...FLIGHT.from, time: '11:05' }, to: { ...FLIGHT.to, time: '15:30' }, note: 'Late inbound aircraft · new boarding 10:30' },
  boarding: { label: 'Boarding', changed: 'group', note: 'Group 2 is boarding now at gate B12' },
}

const TONES: Record<PassStatus, BadgeTone> = { 'on-time': 'success', 'gate-change': 'warning', delayed: 'danger', boarding: 'info' }
const FIELDS: [Field, string][] = [['gate', 'Gate'], ['boards', 'Boards'], ['seat', 'Seat'], ['group', 'Group']]

/** Bar widths in the barcode, seeded from the flight so a pass keeps its code. */
function barsFor(seed: string): [number, number][] {
  let hash = 11
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const bars: [number, number][] = []
  for (let x = 0; x < CODE_WIDTH;) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0
    const width = (hash >>> 30) % 3 + 1
    if (x + width > CODE_WIDTH) break
    bars.push([x, width])
    x += width + ((hash >>> 28) & 1) + 1
  }
  return bars
}

/** The tray with a real notch in each side, so the pass sits on any surface. */
function trayPath(width: number, height: number): string {
  const r = radius.tray
  const y = height - NOTCH_RISE
  const reach = Math.sqrt(NOTCH_RADIUS ** 2 - NOTCH_INSET ** 2)
  const notch = `A${NOTCH_RADIUS} ${NOTCH_RADIUS} 0 1 0`
  const corner = `A${r} ${r} 0 0 1`
  return `M${r} 0H${width - r}${corner} ${width} ${r}V${y - reach}${notch} ${width} ${y + reach}V${height - r}${corner} ${width - r} ${height}H${r}${corner} 0 ${height - r}V${y + reach}${notch} 0 ${y - reach}V${r}${corner} ${r} 0Z`
}

function Barcode({ seed }: { seed: string }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const bars = useMemo(() => barsFor(seed), [seed])
  return (
    <View style={styles.barcode} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg aria-hidden width="100%" height={36} viewBox={`0 0 ${CODE_WIDTH} 36`} preserveAspectRatio="none">
        {bars.map(([x, width]) => <Rect key={x} x={x} width={width} height={36} fill={colors.textPrimary} />)}
      </Svg>
    </View>
  )
}

/** The old value crossfades out. */
function Swap({ value, still, style }: { value: string; still: boolean; style: ComponentProps<typeof Animated.Text>['style'] }) {
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.Text key={value} {...(still ? {} : { entering: swapIn, exiting: swapOut })} style={style}>{value}</Animated.Text>
    </LayoutAnimationConfig>
  )
}

function FieldCell({ name, value, changed, still }: { name: string; value: string; changed: boolean; still: boolean }) {
  const styles = useThemed(createStyles)
  const chip = useSharedValue(changed ? 1 : 0)
  useEffect(() => {
    chip.value = still ? (changed ? 1 : 0) : withTiming(changed ? 1 : 0, BASE)
  }, [changed, chip, still])
  const chipStyle = useAnimatedStyle(() => ({ opacity: chip.value }))
  return (
    <View style={styles.field}>
      <Animated.View style={[styles.chip, chipStyle]} />
      <Text style={styles.label}>{name}</Text>
      <Swap value={value} still={still} style={styles.fieldValue} />
    </View>
  )
}

/** A flight pass as an inset card over a stub. The Badge stamps a new status and the field that changed sits in a chip. */
export function BoardingPass({ status = 'on-time', flight = FLIGHT, patches, mark, renderIcon, animated = true, style }: BoardingPassProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const { label, changed, ...values } = { ...PATCHES[status], ...patches?.[status] }
  const pass: Flight = { ...flight, ...values }
  const late = status === 'delayed'
  const [size, setSize] = useState({ width: 0, height: 0 })

  const lateness = useSharedValue(late ? 1 : 0)
  useEffect(() => {
    lateness.value = still ? (late ? 1 : 0) : withTiming(late ? 1 : 0, BASE)
  }, [late, lateness, still])
  const tint = useAnimatedStyle(() => ({ color: interpolateColor(lateness.value, [0, 1], [colors.textTertiary, colors.danger]) }))

  const announced = useRef(status)
  useEffect(() => {
    if (announced.current === status) return
    announced.current = status
    if (label) AccessibilityInfo.announceForAccessibility(label)
  }, [label, status])

  return (
    <View
      accessible
      accessibilityLabel={`${pass.airline} ${pass.flight}, ${pass.from.code} to ${pass.to.code}, ${label ?? ''}. Gate ${pass.gate}, boards ${pass.boards}, seat ${pass.seat}, group ${pass.group}. ${pass.note}`}
      onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      style={[styles.pass, style]}
    >
      {size.width > 0 ? (
        <Svg aria-hidden width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
          <Path d={trayPath(size.width, size.height)} fill={colors.ink4} />
        </Svg>
      ) : null}
      <Card
        variant="plain"
        animated={animated}
        style={styles.card}
        footerStyle={styles.stubFooter}
        footer={
          <>
            <View style={styles.tear}>
              <Svg aria-hidden width="100%" height={2}>
                <Line x1={0} y1={1} x2="100%" y2={1} stroke={colors.ink10} strokeWidth={2} strokeDasharray={[6, 6]} />
              </Svg>
            </View>
            <View style={styles.stub}>
              <Barcode seed={`${pass.flight}${pass.seat}`} />
              <View style={styles.passenger}>
                <Text style={styles.label}>Passenger</Text>
                <Text style={styles.person}>{pass.passenger}</Text>
                <Text style={styles.label}>{pass.date}</Text>
              </View>
            </View>
          </>
        }
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.airline}>
              <View style={styles.mark}>{withInk(mark ?? renderIcon('plane', 12), colors.textInverse)}</View>
              <Text style={styles.name} numberOfLines={1}>{pass.airline}</Text>
              <Text style={styles.label}>{pass.flight}</Text>
            </View>
            <LayoutAnimationConfig skipEntering>
              <Animated.View key={status} {...(still ? {} : { entering: stampIn, exiting: stampOut })}>
                <Badge size="sm" tone={TONES[status]} animated={animated}>{label}</Badge>
              </Animated.View>
            </LayoutAnimationConfig>
          </View>
          <View style={styles.route}>
            <View style={styles.end}>
              <Text style={styles.code}>{pass.from.code}</Text>
              <View style={styles.place}>
                <Animated.Text style={[styles.label, tint]}>{pass.from.city} · </Animated.Text>
                <Swap value={pass.from.time} still={still} style={[styles.label, tint]} />
              </View>
            </View>
            <View style={styles.path}>
              <View style={styles.pathLine} />
              {withInk(renderIcon('plane', 16), colors.textSecondary)}
              <View style={styles.pathLine} />
            </View>
            <View style={[styles.end, styles.endTo]}>
              <Text style={styles.code}>{pass.to.code}</Text>
              <View style={styles.place}>
                <Swap value={pass.to.time} still={still} style={[styles.label, tint]} />
                <Animated.Text style={[styles.label, tint]}> · {pass.to.city}</Animated.Text>
              </View>
            </View>
          </View>
          <View style={styles.fields}>
            {FIELDS.map(([field, name]) => <FieldCell key={field} name={name} value={pass[field]} changed={changed === field} still={still} />)}
          </View>
          <Swap value={pass.note} still={still} style={styles.note} />
        </View>
      </Card>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  pass: { maxWidth: 358, width: '100%' },
  card: { padding: space[1] },
  content: { gap: space[4.5] },
  label: type(12, c.textTertiary),
  name: { ...type(14, c.textPrimary, '500'), flexShrink: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[3], justifyContent: 'space-between' },
  airline: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[2] },
  mark: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.full, height: 24, justifyContent: 'center', width: 24 },
  route: { alignItems: 'center', flexDirection: 'row' },
  end: { flexShrink: 0, gap: space[0.5] },
  endTo: { alignItems: 'flex-end' },
  code: { ...type(28, c.textPrimary, '600'), lineHeight: 32 },
  place: { flexDirection: 'row' },
  path: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[1.5], minWidth: 0, paddingBottom: space[3], paddingHorizontal: space[3] },
  pathLine: { backgroundColor: c.ink10, flex: 1, height: 2 },
  fields: { alignItems: 'center', flexDirection: 'row', height: 46, justifyContent: 'space-between' },
  field: { gap: space[0.5] },
  chip: { backgroundColor: c.ink5, borderRadius: radius.field, bottom: -space[1], left: -space[1.5], position: 'absolute', right: -space[1.5], top: -space[1] },
  fieldValue: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  note: type(12, c.textSecondary),
  stubFooter: { alignItems: 'stretch', borderTopWidth: 0, flexDirection: 'column', gap: 0, justifyContent: 'flex-start', padding: 0 },
  tear: { marginHorizontal: space[4.5], marginVertical: space[2] },
  stub: { alignItems: 'center', flexDirection: 'row', gap: space[3], height: 76, justifyContent: 'space-between', paddingBottom: space[3], paddingHorizontal: space[4], paddingTop: space[2.5] },
  barcode: { backgroundColor: c.muted, borderRadius: radius.xl, flexBasis: 224, flexGrow: 0, flexShrink: 1, height: 52, minWidth: 0, paddingHorizontal: space[2.5], paddingVertical: space[2] },
  passenger: { alignItems: 'flex-end', flexShrink: 0, gap: space[0.5] },
  person: type(14, c.textPrimary, '500'),
})
