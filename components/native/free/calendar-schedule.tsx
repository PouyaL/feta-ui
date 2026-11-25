import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown } from 'react-native-reanimated'
import { pressedState, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { IconButton } from './icon-button'
import { iconFor } from './label'

const WEEK = 7
const STAGGER_MS = 40
const OPEN_MS = 180
const DOTS = 3
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const riseIn = (delay: number) => FadeInDown.duration(OPEN_MS).delay(delay).easing(OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })

export type ScheduleEvent = { id: string; date: Date; title: string; time: string; /** Where, like Main room · 8 attendees. */ place?: string; tone?: 'ink' | 'success' | 'warning' | 'danger' }

export type CalendarScheduleProps = {
  month: Date
  events: ScheduleEvent[]
  /** Today, passed in so a host can pin it. */
  today?: Date
  defaultSelected?: Date
  onAdd?: (day: Date) => void
  locale?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const key = (date: Date): string => date.toDateString()

/** A month with a dot per event, and the picked day's agenda under it. */
export function CalendarSchedule({ month: firstMonth, events, today, defaultSelected, onAdd, locale = 'en-US', renderIcon, animated = true, style }: CalendarScheduleProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [month, setMonth] = useState(new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1))
  const [selected, setSelected] = useState(defaultSelected ?? today ?? firstMonth)
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleEvent[]>()
    for (const event of events) map.set(key(event.date), [...(map.get(key(event.date)) ?? []), event])
    return map
  }, [events])
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const lead = first.getDay()
    const count = Math.ceil((lead + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / WEEK) * WEEK
    return Array.from({ length: count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - lead + i))
  }, [month])
  const weeks = useMemo(() => Array.from({ length: days.length / WEEK }, (_, row) => days.slice(row * WEEK, (row + 1) * WEEK)), [days])
  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)
  const weekdays = useMemo(() => Array.from({ length: WEEK }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2023, 0, 1 + i))), [locale])
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' })
  const agenda = byDay.get(key(selected)) ?? []
  const monthCount = events.filter((event) => event.date.getMonth() === month.getMonth() && event.date.getFullYear() === month.getFullYear()).length
  const toneStyle = (tone: ScheduleEvent['tone']) => (tone === 'success' ? styles.toneSuccess : tone === 'warning' ? styles.toneWarning : tone === 'danger' ? styles.toneDanger : null)

  return (
    <View accessibilityLabel="Schedule" style={[styles.tray, style]}>
      <View style={styles.body}>
        <View style={styles.calendar}>
          <View style={styles.head}>
            <View style={styles.heading}>
              <Text accessibilityLiveRegion="polite" style={styles.title}>{title}</Text>
              <Text style={styles.caption}>{monthCount} {monthCount === 1 ? 'event' : 'events'} this month</Text>
            </View>
            <IconButton variant="ghost" size="sm" animated={animated} label="Previous month" icon={iconFor(renderIcon, 'chevron-left', 16, colors.textPrimary)} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
            <IconButton variant="ghost" size="sm" animated={animated} label="Next month" icon={iconFor(renderIcon, 'chevron-right', 16, colors.textPrimary)} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
          </View>
          <View style={styles.week}>
            {weekdays.map((weekday, i) => <Text key={i} style={styles.weekday}>{weekday}</Text>)}
          </View>
          {weeks.map((week, row) => (
            <View key={row} style={styles.week}>
              {week.map((day) => {
                const list = byDay.get(key(day)) ?? []
                const on = key(day) === key(selected)
                const isToday = Boolean(today && key(today) === key(day))
                return (
                  <Pressable
                    key={key(day)}
                    accessibilityLabel={`${long.format(day)}, ${list.length} ${list.length === 1 ? 'event' : 'events'}`}
                    accessibilityRole="button"
                    {...pressedState(on)}
                    style={[styles.day, on && styles.dayOn]}
                    onPress={() => setSelected(day)}
                  >
                    <View style={[styles.number, isToday && styles.numberToday]}>
                      <Text style={[styles.numberText, day.getMonth() !== month.getMonth() && styles.outside, isToday && styles.numberTextToday]}>{day.getDate()}</Text>
                    </View>
                    <View style={styles.dots}>
                      {list.slice(0, DOTS).map((event) => <View key={event.id} style={[styles.dot, toneStyle(event.tone)]} />)}
                    </View>
                  </Pressable>
                )
              })}
            </View>
          ))}
        </View>
        {/* The live region stays mounted, so a new day is read as a change; only the content inside remounts and rises. */}
        <View role="group" accessibilityLabel="Agenda" accessibilityLiveRegion="polite" style={styles.agenda}>
          <Animated.View key={key(selected)} {...(still ? {} : { entering: riseIn(0) })} style={styles.agendaBody}>
            <View style={styles.agendaHead}>
              <View style={styles.agendaTitle}>
                <Text style={styles.agendaDay}>{long.format(selected)}</Text>
                {today && key(today) === key(selected) ? <Text style={styles.today}>Today</Text> : null}
              </View>
              {onAdd ? <IconButton variant="outline" size="sm" animated={animated} label="Add event" icon={iconFor(renderIcon, 'plus', 16, colors.textPrimary)} onPress={() => onAdd(selected)} /> : null}
            </View>
            {agenda.length ? (
              <View style={styles.rows}>
                {agenda.map((event, i) => (
                  <Animated.View key={event.id} {...(still ? {} : { entering: riseIn(i * STAGGER_MS) })} style={styles.row}>
                    <Text style={[styles.rowTitle, event.tone && event.tone !== 'ink' ? styles.rowTone : null]}>{event.title}</Text>
                    <Text style={styles.caption}>{event.time}</Text>
                    {event.place ? <Text style={styles.caption}>{event.place}</Text> : null}
                  </Animated.View>
                ))}
              </View>
            ) : <Text style={styles.empty}>Nothing planned</Text>}
          </Animated.View>
        </View>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1.5], width: '100%' },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, overflow: 'hidden' },
  calendar: { padding: space[3] },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[0.5], marginBottom: space[2] },
  heading: { flex: 1 },
  title: type(16, c.textPrimary, '500'),
  caption: type(12, c.textSecondary),
  week: { flexDirection: 'row', gap: space[0.5], marginBottom: space[0.5] },
  weekday: { ...type(12, c.textTertiary, '400', true), flex: 1, padding: space[1], textAlign: 'center' },
  day: { alignItems: 'center', borderColor: 'transparent', borderRadius: radius.field, borderWidth: 1.5, flex: 1, gap: space[0.5], minHeight: 48, padding: space[1] },
  dayOn: { borderColor: c.textPrimary },
  number: { alignItems: 'center', borderRadius: radius.full, height: 22, justifyContent: 'center', width: 22 },
  numberToday: { backgroundColor: c.inverse },
  numberText: type(14, c.textPrimary, '500'),
  numberTextToday: { color: c.textInverse },
  outside: { color: c.textTertiary },
  dots: { flexDirection: 'row', gap: space[0.5], height: 4 },
  dot: { backgroundColor: c.textPrimary, borderRadius: radius.full, height: 4, width: 4 },
  toneSuccess: { backgroundColor: c.success },
  toneWarning: { backgroundColor: c.textSecondary },
  toneDanger: { backgroundColor: c.danger },
  agenda: { borderTopColor: c.ink8, borderTopWidth: 1, padding: space[4] },
  agendaBody: { gap: space[2] },
  agendaHead: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', minHeight: 36 },
  agendaTitle: { alignItems: 'baseline', flexDirection: 'row', flexShrink: 1, gap: space[1.5] },
  agendaDay: { ...type(15, c.textPrimary, '500'), flexShrink: 1 },
  today: type(12, c.textTertiary, '500'),
  rows: { gap: space[1.5] },
  row: { backgroundColor: c.ink4, borderRadius: radius.xl, paddingHorizontal: space[3], paddingVertical: space[2.5] },
  rowTitle: type(14, c.textPrimary, '500'),
  rowTone: { fontWeight: '600' },
  empty: type(14, c.textTertiary),
})
