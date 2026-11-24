import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInLeft, FadeInRight, FadeOut, FadeOutLeft, FadeOutRight, ZoomIn } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { IconButton } from './icon-button'
import { iconFor } from './label'
import { Select } from './select'

const WEEK = 7
const ROWS = 6
const CELL = 44
const ROW_HEIGHT = CELL + space[0.5]
const FOCUS_MS = 120
const MONTH_MS = 280
const NO_DATES: Date[] = []
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const chipIn = ZoomIn.springify().stiffness(420).damping(26).mass(1).withInitialValues({ transform: [{ scale: 0.9 }] })

export type DateRange = { start: Date; end: Date | null }

type Shared = {
  /** The month to open on. Defaults to the value, then today. */
  defaultMonth?: Date
  /** Two months, one above the other. */
  months?: 1 | 2
  /** Days that cannot be picked. */
  isDisabled?: (date: Date) => boolean
  /** Days shown struck through. */
  booked?: Date[]
  /** Days with a dot. */
  events?: Date[]
  /** Month and year selects replace the title. */
  dropdowns?: boolean
  locale?: string
  /** The day ringed as today. Defaults to the device's date. */
  today?: Date
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

export type CalendarProps = Shared & (
  | { mode?: 'single'; value?: Date | null; defaultValue?: Date | null; onValueChange?: (value: Date | null) => void; onApply?: never; slots?: never; slot?: never; onSlotChange?: never }
  | { mode: 'range'; value?: DateRange | null; defaultValue?: DateRange | null; onValueChange?: (value: DateRange | null) => void; /** Adds the summary and Apply footer. */ onApply?: (value: DateRange) => void; slots?: never; slot?: never; onSlotChange?: never }
  | { mode: 'datetime'; value?: Date | null; defaultValue?: Date | null; onValueChange?: (value: Date | null) => void; onApply?: (value: Date, slot: string) => void; /** Time slots under the month. */ slots: string[]; slot?: string; onSlotChange?: (slot: string) => void }
)

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1)
const addMonths = (date: Date, count: number): Date => new Date(date.getFullYear(), date.getMonth() + count, 1)
const addDays = (date: Date, count: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + count)
const sameDay = (a: Date | null | undefined, b: Date | null | undefined): boolean => Boolean(a && b) && a?.toDateString() === b?.toDateString()
const dayValue = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
const between = (date: Date, a: Date, b: Date): boolean => {
  const low = Math.min(dayValue(a), dayValue(b))
  const high = Math.max(dayValue(a), dayValue(b))
  return dayValue(date) > low && dayValue(date) < high
}
const years = (around: number): { value: string; label: string }[] => Array.from({ length: 11 }, (_, i) => ({ value: String(around - 5 + i), label: String(around - 5 + i) }))

function monthDays(month: Date): Date[] {
  const first = startOfMonth(month)
  return Array.from({ length: WEEK * ROWS }, (_, i) => addDays(first, i - first.getDay()))
}

type DayProps = { day: Date; label: string; outside: boolean; today: boolean; booked: boolean; off: boolean; band: boolean; start: boolean; end: boolean; chosen: boolean; event: boolean; still: boolean; onPick: () => void }

function Day({ day, label, outside, today, booked, off, band, start, end, chosen, event, still, onPick }: DayProps) {
  const styles = useThemed(createStyles)
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      aria-disabled={off || booked}
      aria-selected={chosen}
      disabled={off || booked}
      style={({ pressed }) => [styles.day, today && styles.today, outside && styles.outside, off && styles.off, band && styles.band, start && styles.bandStart, end && styles.bandEnd, pressed && !chosen && styles.pressed]}
      onPress={onPick}
    >
      {chosen ? <Animated.View {...(still ? {} : { entering: chipIn })} style={styles.chip} /> : null}
      <Text style={[styles.number, today && styles.numberToday, booked && styles.numberBooked, chosen && styles.numberChosen]}>{day.getDate()}</Text>
      {event ? <View style={[styles.dot, chosen && styles.dotChosen]} /> : null}
    </Pressable>
  )
}

/** Pick a date, a range, or a date and time. Six rows always, so the height never jumps. */
export function Calendar(props: CalendarProps) {
  const { defaultMonth, months = 1, isDisabled, booked = NO_DATES, events = NO_DATES, locale = 'en-US', dropdowns = false, today: todayProp, renderIcon, animated = true, style } = props
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const ranged = props.mode === 'range' ? props : null
  const dated = props.mode === 'range' ? null : props
  const timed = props.mode === 'datetime' ? props : null
  const [heldDate, setHeldDate] = useState<Date | null>(dated?.defaultValue ?? null)
  const [heldRange, setHeldRange] = useState<DateRange | null>(ranged?.defaultValue ?? null)
  const date = dated ? (dated.value === undefined ? heldDate : dated.value) : null
  const range = ranged ? (ranged.value === undefined ? heldRange : ranged.value) : null
  const [deviceToday] = useState(() => new Date())
  const today = todayProp ?? deviceToday
  const [view, setView] = useState(() => startOfMonth(defaultMonth ?? date ?? range?.start ?? today))
  const [direction, setDirection] = useState(1)
  const [heldSlot, setHeldSlot] = useState<string | undefined>(undefined)
  const slot = timed ? timed.slot ?? heldSlot : undefined

  const dayFormat = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), [locale])
  const titleFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale])
  const shortFormat = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }), [locale])
  const monthNames = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { month: 'short' })
    return Array.from({ length: 12 }, (_, i) => ({ value: String(i), label: format.format(new Date(2023, i, 1)) }))
  }, [locale])
  const weekdays = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    const long = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    return Array.from({ length: WEEK }, (_, i) => { const d = new Date(2023, 0, 1 + i); return { short: format.format(d).slice(0, 2), long: long.format(d) } })
  }, [locale])
  const bookedDays = useMemo(() => new Set(booked.map(dayValue)), [booked])

  function page(step: number): void {
    setDirection(step)
    setView((current) => addMonths(current, step))
  }

  function jump(month: Date): void {
    setDirection(month > view ? 1 : -1)
    setView(month)
  }

  function setRange(next: DateRange | null): void {
    setHeldRange(next)
    ranged?.onValueChange?.(next)
  }

  function pick(day: Date): void {
    if (ranged) {
      setRange(!range || range.end || dayValue(day) < dayValue(range.start) ? { start: day, end: null } : { start: range.start, end: day })
    } else {
      setHeldDate(day)
      dated?.onValueChange?.(day)
    }
  }

  function dayCell(day: Date, month: Date): ReactNode {
    const start = sameDay(range?.start, day)
    const finish = sameDay(range?.end, day)
    return (
      <Day
        key={day.toISOString()}
        day={day}
        label={dayFormat.format(day)}
        outside={day.getMonth() !== month.getMonth()}
        today={sameDay(today, day)}
        booked={bookedDays.has(dayValue(day))}
        off={Boolean(isDisabled?.(day))}
        band={Boolean(range?.end && between(day, range.start, range.end))}
        start={start && Boolean(range?.end)}
        end={finish}
        chosen={sameDay(date, day) || start || finish}
        event={events.some((event) => sameDay(event, day))}
        still={still}
        onPick={() => pick(day)}
      />
    )
  }

  const shown = Array.from({ length: months }, (_, i) => addMonths(view, i))
  const applyRange = ranged?.onApply
  const applyDatetime = timed?.onApply
  const summary = range ? `${shortFormat.format(range.start)}${range.end ? ` to ${shortFormat.format(range.end)}` : ''}` : 'Pick a start date'

  return (
    <View style={[styles.calendar, style]}>
      <View style={styles.card}>
        {shown.map((month, i) => {
          const days = monthDays(month)
          const key = month.toISOString()
          return (
            <View key={i}>
              <View style={styles.header}>
                {i === 0 ? <IconButton variant="ghost" size="sm" animated={animated} label="Previous month" icon={iconFor(renderIcon, 'arrow-left', 16, colors.textPrimary)} onPress={() => page(-1)} /> : <View style={styles.navSpace} />}
                {dropdowns ? (
                  <View style={styles.selects}>
                    <Select kind="pill" accessibilityLabel="Month" animated={animated} value={String(month.getMonth())} options={monthNames} onValueChange={(next) => jump(new Date(month.getFullYear(), Number(next), 1))} />
                    <Select kind="pill" accessibilityLabel="Year" animated={animated} value={String(month.getFullYear())} options={years(month.getFullYear())} onValueChange={(next) => jump(new Date(Number(next), month.getMonth(), 1))} />
                  </View>
                ) : (
                  <View accessibilityLiveRegion="polite" style={styles.titleBox}>
                    <Animated.Text key={key} {...(still ? {} : { entering: FadeIn.duration(FOCUS_MS), exiting: FadeOut.duration(FOCUS_MS) })} style={styles.title}>{titleFormat.format(month)}</Animated.Text>
                  </View>
                )}
                {i === shown.length - 1 ? <IconButton variant="ghost" size="sm" animated={animated} label="Next month" icon={iconFor(renderIcon, 'arrow-right', 16, colors.textPrimary)} onPress={() => page(1)} /> : <View style={styles.navSpace} />}
              </View>
              <View style={styles.week}>
                {weekdays.map((d) => <Text key={d.long} accessibilityLabel={d.long} style={styles.weekday}>{d.short}</Text>)}
              </View>
              <View style={styles.rows}>
                <Animated.View
                  key={key}
                  {...(still ? {} : { entering: (direction > 0 ? FadeInRight : FadeInLeft).duration(MONTH_MS).easing(OUT), exiting: (direction > 0 ? FadeOutLeft : FadeOutRight).duration(MONTH_MS).easing(OUT) })}
                  style={styles.page}
                >
                  {Array.from({ length: ROWS }, (_, row) => (
                    <View key={row} style={styles.week}>
                      {days.slice(row * WEEK, (row + 1) * WEEK).map((day) => dayCell(day, month))}
                    </View>
                  ))}
                </Animated.View>
              </View>
            </View>
          )
        })}
      </View>
      {timed ? (
        <View accessibilityLabel="Time" style={styles.slots}>
          {timed.slots.map((time) => (
            <Button key={time} size="sm" shape="pill" variant={slot === time ? 'primary' : 'secondary'} animated={animated} aria-selected={slot === time} onPress={() => { setHeldSlot(time); timed.onSlotChange?.(time) }}>{time}</Button>
          ))}
        </View>
      ) : null}
      {applyRange ? (
        <View style={styles.footer}>
          <Text style={styles.summary}>{summary}</Text>
          <Button size="sm" variant="ghost" animated={animated} onPress={() => setRange(null)}>Clear</Button>
          <Button size="sm" animated={animated} disabled={!range?.end} onPress={() => { if (range) applyRange(range) }}>Apply</Button>
        </View>
      ) : null}
      {applyDatetime ? (
        <View style={styles.footer}>
          <Text style={styles.summary}>{date ? `${shortFormat.format(date)}${slot ? ` at ${slot}` : ''}` : 'Pick a date'}</Text>
          <Button size="sm" animated={animated} disabled={!date || !slot} onPress={() => { if (date && slot) applyDatetime(date, slot) }}>Confirm</Button>
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  calendar: { backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: '100%', padding: space[1] },
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[5], padding: space[3] },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: space[1] },
  navSpace: { width: 36 },
  titleBox: { alignItems: 'center', flex: 1, overflow: 'hidden' },
  selects: { flex: 1, flexDirection: 'row', gap: space[1], justifyContent: 'center' },
  title: type(16, c.textPrimary, '600'),
  week: { flexDirection: 'row', marginBottom: space[0.5] },
  weekday: { ...type(12, c.textSecondary, '500'), flex: 1, lineHeight: 24, textAlign: 'center' },
  rows: { height: ROW_HEIGHT * ROWS, overflow: 'hidden' },
  page: { ...StyleSheet.absoluteFill },
  day: { alignItems: 'center', borderRadius: radius.control, flex: 1, height: CELL, justifyContent: 'center', minWidth: 40 },
  today: { borderColor: c.ink10, borderWidth: 1 },
  outside: { opacity: 0.67 },
  off: { opacity: 0.3 },
  band: { backgroundColor: c.ink5, borderRadius: 0 },
  bandStart: { backgroundColor: c.ink5, borderBottomRightRadius: 0, borderTopRightRadius: 0 },
  bandEnd: { backgroundColor: c.ink5, borderBottomLeftRadius: 0, borderTopLeftRadius: 0 },
  pressed: { backgroundColor: c.ink5 },
  chip: { ...StyleSheet.absoluteFill, backgroundColor: c.inverse, borderRadius: radius.control },
  number: type(16, c.textPrimary, '500'),
  numberToday: { fontWeight: '600' },
  numberBooked: { color: c.textTertiary, textDecorationLine: 'line-through' },
  numberChosen: { color: c.textInverse },
  dot: { backgroundColor: c.textSecondary, borderRadius: radius.full, bottom: space[2], height: 4, position: 'absolute', width: 4 },
  dotChosen: { backgroundColor: c.textInverse },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5], paddingBottom: space[1], paddingHorizontal: space[2], paddingTop: space[2] },
  footer: { alignItems: 'center', flexDirection: 'row', gap: space[1], paddingHorizontal: space[3], paddingVertical: space[2] },
  summary: { ...type(14, c.textSecondary, '500'), flex: 1, minWidth: 0 },
})
