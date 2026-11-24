import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { LabelSwap, iconFor } from './label'

const SNAP = 0.25
const HOUR = 40
const MESSAGE_MS = 180
const ROW = { stiffness: 320, damping: 30, mass: 1 } as const
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const noteIn = FadeInDown.duration(MESSAGE_MS).easing(OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 4 }] })

export type SlotDay = { key: string; label: string; /** Used in the summary, like Mon, Nov 2. */ date: string; free: string; busy: [start: number, end: number][] }

export type SlotPickerProps = {
  title: string
  /** Under the title, like with Lena Ortiz · Lisbon. */
  subtitle?: string
  avatar?: ReactNode
  days: SlotDay[]
  /** Length options in minutes. */
  lengths?: number[]
  /** The viewer's zone, for the footer. */
  zone?: string
  /** The host, to show their local time and who gets the invite. */
  host?: { name: string; city: string; /** Hours ahead of the viewer. */ offset: number }
  /** The hour the timeline starts and ends. Default 9 and 17. */
  from?: number
  to?: number
  onConfirm?: (day: string, start: number, minutes: number) => void
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const lengthLabel = (minutes: number): string => (minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`)
const time = (hour: number): string => {
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}`
}
const clock = (hour: number): string => `${time(hour)}${hour >= 12 ? 'pm' : 'am'}`
const upper = (hour: number): string => `${time(hour)} ${hour >= 12 ? 'PM' : 'AM'}`

/** Book a time by placing a block on a day's timeline. It snaps to 15 minutes and avoids busy time. */
export function SlotPicker({ title, subtitle, avatar, days, lengths = [30, 60, 90], zone = 'Your time', host, from = 9, to = 17, onConfirm, renderIcon, animated = true, style }: SlotPickerProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [dayKey, setDayKey] = useState(days[0]?.key ?? '')
  const [minutes, setMinutes] = useState(lengths[1] ?? lengths[0] ?? 60)
  const [start, setStart] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [booked, setBooked] = useState(false)
  const grabbed = useRef(0)
  const top = useSharedValue(0)
  const height = useSharedValue(HOUR)
  const placed = useRef(false)
  const day = days.find((one) => one.key === dayKey) ?? days[0]
  const busy = day?.busy ?? []
  const span = minutes / 60
  const total = to - from

  const free = (at: number): boolean => at >= from && at + span <= to && !busy.some(([s, e]) => at < e && at + span > s)
  /** The nearest free start, so a block never lands on busy time. */
  const nearest = (at: number): number | null => {
    for (let gap = 0; gap <= total; gap += SNAP) {
      if (free(at + gap)) return at + gap
      if (free(at - gap)) return at - gap
    }
    return null
  }
  const snapped = (hour: number): number => from + Math.round((hour - from) / SNAP) * SNAP
  const pick = (next: number | null): void => { if (next !== null) { setStart(next); setBooked(false) } }

  useEffect(() => {
    if (start === null) { placed.current = false; return }
    const y = (start - from) * HOUR
    const size = span * HOUR
    const jump = still || dragging || !placed.current
    top.value = jump ? y : withSpring(y, ROW)
    height.value = jump ? size : withSpring(size, ROW)
    placed.current = true
  }, [start, span, from, still, dragging, top, height])

  function nudge(by: number): void {
    if (start === null) return
    let at = start + by
    while (at >= from && at + span <= to && !free(at)) at += by
    if (free(at)) pick(at)
  }

  const place = Gesture.Tap().runOnJS(true).onEnd((e) => pick(nearest(snapped(from + e.y / HOUR - span / 2))))
  const drag = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin(() => { grabbed.current = start ?? from; setDragging(true) })
    .onUpdate((e) => pick(nearest(snapped(grabbed.current + e.translationY / HOUR))))
    .onFinalize(() => setDragging(false))
    .blocksExternalGesture(place)

  const block = useAnimatedStyle(() => ({ height: height.value, top: top.value }))

  const summary = start !== null ? `${day?.date ?? ''} · ${time(start)} to ${upper(start + span)}` : 'Tap a free gap, then drag to move'
  const note = start === null || !host ? null : booked ? `Invite sent to ${host.name}` : `${upper((start + host.offset) % 24)} for ${host.name} in ${host.city}`

  return (
    <View accessibilityLabel={title} style={[styles.card, style]}>
      <View style={styles.head}>
        {avatar}
        <View style={styles.heading}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.caption}>{subtitle}</Text> : null}
        </View>
      </View>
      <View accessibilityLabel="Length" accessibilityRole="radiogroup" style={styles.lengths}>
        {lengths.map((length) => {
          const on = length === minutes
          return (
            <Pressable key={length} accessibilityLabel={lengthLabel(length)} accessibilityRole="radio" aria-checked={on} hitSlop={6} style={[styles.length, on && styles.lengthOn]} onPress={() => { setMinutes(length); setStart(null); setBooked(false) }}>
              <Text style={[styles.lengthText, on && styles.textOn]}>{lengthLabel(length)}</Text>
            </Pressable>
          )
        })}
      </View>
      <View accessibilityLabel="Day" accessibilityRole="radiogroup" style={styles.days}>
        {days.map((one) => {
          const on = one.key === dayKey
          const full = one.free === 'Full'
          return (
            <Pressable key={one.key} accessibilityLabel={`${one.label}, ${one.free}`} accessibilityRole="radio" aria-checked={on} aria-disabled={full} disabled={full} style={[styles.day, on && styles.dayOn, full && styles.dayFull]} onPress={() => { setDayKey(one.key); setStart(null); setBooked(false) }}>
              <Text style={[styles.dayText, on && styles.textOn]}>{one.label}</Text>
              <Text style={[styles.dayFree, on && styles.textOn]}>{one.free}</Text>
            </Pressable>
          )
        })}
      </View>
      <View style={styles.timeline}>
        <View style={styles.hours}>
          {Array.from({ length: total + 1 }, (_, i) => <Text key={i} style={styles.hour}>{clock(from + i)}</Text>)}
        </View>
        <GestureDetector gesture={place}>
          <View accessibilityLabel="Timeline. Choose where the meeting goes." collapsable={false} style={[styles.line, { height: total * HOUR }]}>
            {Array.from({ length: total }, (_, i) => <View key={i} style={styles.rule} />)}
            {busy.filter(([s, e]) => e > from && s < to).map(([s, e]) => {
              const low = Math.max(s, from)
              return <View key={s} style={[styles.busy, { height: (Math.min(e, to) - low) * HOUR, top: (low - from) * HOUR }]}><Text style={styles.busyText}>Busy</Text></View>
            })}
            {start !== null ? (
              <GestureDetector gesture={drag}>
                <Animated.View
                  accessible
                  accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                  accessibilityLabel="Meeting start"
                  accessibilityRole="adjustable"
                  aria-valuemin={from}
                  aria-valuemax={to}
                  aria-valuenow={start}
                  aria-valuetext={`${time(start)} to ${upper(start + span)}`}
                  collapsable={false}
                  style={[styles.block, block]}
                  onAccessibilityAction={(e: AccessibilityActionEvent) => nudge(e.nativeEvent.actionName === 'increment' ? SNAP : -SNAP)}
                >
                  <Text style={styles.blockText}>{time(start)} to {time(start + span)}</Text>
                  <View style={styles.handle} />
                </Animated.View>
              </GestureDetector>
            ) : null}
          </View>
        </GestureDetector>
      </View>
      <View style={styles.foot}>
        <Text style={styles.caption}>{zone}</Text>
        <View style={styles.footRow}>
          <View style={styles.summary}>
            <View accessibilityLiveRegion="polite"><LabelSwap swapKey={summary} still={still} style={styles.when}>{summary}</LabelSwap></View>
            {note ? (
              <Animated.View key={note} {...(still ? {} : { entering: noteIn })} style={styles.done}>
                {booked ? iconFor(renderIcon, 'tick-02', 16, colors.success) : null}
                <Text style={[styles.caption, booked && styles.noteBooked]}>{note}</Text>
              </Animated.View>
            ) : null}
          </View>
          <Button size="sm" animated={animated} disabled={start === null || booked} onPress={() => { if (start !== null) { setBooked(true); onConfirm?.(dayKey, start, minutes) } }}>{booked ? 'Booked' : 'Confirm'}</Button>
        </View>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.frame, borderWidth: 1, gap: space[3], padding: space[4], width: '100%' },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  heading: { flex: 1 },
  title: type(16, c.textPrimary, '500'),
  caption: type(12, c.textSecondary),
  lengths: { backgroundColor: c.ink4, borderRadius: radius.full, flexDirection: 'row', gap: space[0.5], padding: space[1] },
  length: { alignItems: 'center', borderRadius: radius.full, flex: 1, height: 32, justifyContent: 'center' },
  lengthOn: { backgroundColor: c.inverse },
  lengthText: type(14, c.textPrimary, '500'),
  textOn: { color: c.textInverse },
  days: { flexDirection: 'row', gap: space[1] },
  day: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.xl, flex: 1, gap: space[0.5], minHeight: 44, paddingHorizontal: space[0.5], paddingVertical: space[1.5] },
  dayOn: { backgroundColor: c.inverse },
  dayFull: { opacity: 0.45 },
  dayText: type(14, c.textPrimary, '500'),
  dayFree: { ...type(12, c.textPrimary, '500'), opacity: 0.65 },
  timeline: { flexDirection: 'row', gap: space[2] },
  hours: { width: 40 },
  hour: { ...type(12, c.textTertiary, '400', true), height: HOUR, transform: [{ translateY: -6 }] },
  line: { backgroundColor: c.ink4, borderRadius: radius.field, flex: 1, overflow: 'hidden' },
  rule: { borderTopColor: c.ink5, borderTopWidth: 1, height: HOUR },
  busy: { backgroundColor: c.ink5, borderRadius: radius.field, left: 0, paddingHorizontal: space[2.5], paddingVertical: space[1.5], position: 'absolute', right: 0 },
  busyText: type(12, c.textTertiary, '500'),
  block: { backgroundColor: c.inverse, borderRadius: radius.field, flexDirection: 'row', justifyContent: 'space-between', left: 0, paddingHorizontal: space[2.5], paddingVertical: space[1.5], position: 'absolute', right: 0 },
  blockText: type(14, c.textInverse, '500'),
  handle: { alignSelf: 'center', backgroundColor: c.textInverse, borderRadius: radius.xs, bottom: space[1], height: 3, opacity: 0.5, position: 'absolute', width: 20 },
  foot: { gap: space[1] },
  footRow: { alignItems: 'flex-end', flexDirection: 'row', gap: space[2] },
  summary: { flex: 1, minWidth: 0 },
  when: type(14, c.textPrimary, '500'),
  done: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  noteBooked: { color: c.success },
})
