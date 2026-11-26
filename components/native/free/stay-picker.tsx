import { useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInUp, FadeOut } from 'react-native-reanimated'
import { pressedState, radius, space, useColors, type Colors } from '../kit'
import { Button, SELF } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { IconButton } from './icon-button'
import { LabelSwap, RollingText, iconFor } from './label'

const MESSAGE_MS = 180
const FAST_MS = 150
const WEEK = 7
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const refusedIn = FadeInUp.duration(MESSAGE_MS).easing(OUT).withInitialValues({ opacity: 0, transform: [{ translateY: -4 }] })

export type StayRange = { from: Date; to: Date }

export type StayPickerProps = {
  /** The month shown first. */
  month: Date
  /** The price of a night, or null when it is booked. */
  priceFor: (night: Date) => number | null
  currency?: string
  /** Named under the title. Default USD. */
  currencyName?: string
  onReserve?: (stay: StayRange, total: number) => void
  locale?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const same = (a: Date | null, b: Date | null): boolean => Boolean(a && b) && a?.toDateString() === b?.toDateString()
const add = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const nights = (a: Date, b: Date): Date[] => {
  const out: Date[] = []
  for (let d = a; d < b; d = add(d, 1)) out.push(d)
  return out
}

/** Pick a stay night by night, with prices in the grid. A range cannot cross a booked night. */
export function StayPicker({ month: firstMonth, priceFor, currency = '$', currencyName = 'USD', onReserve, locale = 'en-US', renderIcon, animated = true, style }: StayPickerProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [month, setMonth] = useState(new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1))
  const [from, setFrom] = useState<Date | null>(null)
  const [to, setTo] = useState<Date | null>(null)
  const [refused, setRefused] = useState<Date | null>(null)
  const [reserved, setReserved] = useState(false)
  const days = useMemo(() => Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)), [month])
  const prices = useMemo(() => days.map(priceFor), [days, priceFor])
  const lowest = useMemo(() => Math.min(...prices.filter((p): p is number => p !== null)), [prices])
  const title = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(month)
  const weekdays = useMemo(() => Array.from({ length: WEEK }, (_, i) => new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2023, 0, 2 + i)).slice(0, 2)), [locale])
  const stamp = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' })
  const long = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' })
  const short = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  const total = from && to ? nights(from, to).reduce((sum, night) => sum + (priceFor(night) ?? 0), 0) : 0

  function choose(day: Date): void {
    setReserved(false)
    setRefused(null)
    if (!from || to || day <= from) { setFrom(day); setTo(null); return }
    const full = nights(from, day).find((night) => priceFor(night) === null)
    if (full) { setRefused(full); return }
    setTo(day)
  }

  const blank = (month.getDay() + 6) % WEEK
  const cells: (Date | null)[] = [...Array.from({ length: blank }, () => null), ...days]
  const weeks = Array.from({ length: Math.ceil(cells.length / WEEK) }, (_, row) => cells.slice(row * WEEK, (row + 1) * WEEK))
  const count = from && to ? nights(from, to).length : 0
  const summary = from && to ? `${stamp.format(from)} → ${stamp.format(to)} · ${count} ${count === 1 ? 'night' : 'nights'}` : from ? `Check-in ${stamp.format(from)}. Now pick check-out` : 'Pick a check-in night'

  return (
    <View accessibilityLabel="Choose your stay" style={[styles.card, style]}>
      <View style={styles.head}>
        <IconButton style={SELF.center} variant="ghost" size="sm" animated={animated} label="Previous month" icon={iconFor(renderIcon, 'chevron-left', 16, colors.textPrimary)} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <View style={styles.heading}>
          <Text accessibilityLiveRegion="polite" style={styles.title}>{title}</Text>
          <Text style={styles.caption}>Nightly price in {currencyName}</Text>
        </View>
        <IconButton style={SELF.center} variant="ghost" size="sm" animated={animated} label="Next month" icon={iconFor(renderIcon, 'chevron-right', 16, colors.textPrimary)} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} />
      </View>
      <View accessibilityLabel={title} style={styles.grid}>
        <View style={styles.week}>
          {weekdays.map((weekday) => <Text key={weekday} style={styles.weekday}>{weekday}</Text>)}
        </View>
        {weeks.map((week, row) => (
          <View key={row} style={styles.week}>
            {Array.from({ length: WEEK }, (_, column) => {
              const day = week[column] ?? null
              if (!day) return <View key={column} style={styles.blank} />
              const price = prices[day.getDate() - 1] ?? null
              const booked = price === null
              const start = same(day, from)
              const end = same(day, to)
              const inside = Boolean(from && to && day > from && day < to)
              return (
                <Pressable
                  key={day.toDateString()}
                  accessibilityLabel={`${long.format(day)}, ${booked ? 'full' : `${currency}${price}`}`}
                  accessibilityRole="button"
                  aria-disabled={booked}
                  {...pressedState(start || end || inside)}
                  style={[styles.night, inside && styles.nightInside, (start || end) && styles.nightEnd, same(day, refused) && styles.nightRefused]}
                  onPress={() => { if (booked) { setReserved(false); setRefused(day) } else choose(day) }}
                >
                  <Text style={[styles.date, booked && styles.dateBooked, (start || end) && styles.onInk]}>{day.getDate()}</Text>
                  <Text style={[styles.price, price === lowest && styles.priceLow, (start || end) && styles.onInkSoft]}>{booked ? 'Full' : `${currency}${price}`}</Text>
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>
      <View accessibilityLiveRegion="polite" style={styles.note}>
        {refused ? (
          <Animated.Text key="refused" {...(still ? {} : { entering: refusedIn, exiting: FadeOut.duration(FAST_MS) })} style={styles.refused}>
            {short.format(refused)} is booked. Check out on {short.format(refused)} or earlier
          </Animated.Text>
        ) : <LabelSwap swapKey={summary} still={still} style={styles.noteText}>{summary}</LabelSwap>}
      </View>
      <View style={styles.foot}>
        <View style={styles.totalBox}>
          <Text style={styles.caption}>Total</Text>
          {total ? (
            <View style={styles.totalRow}>
              <Text style={styles.total}>{currency}</Text>
              <RollingText value={String(total)} still={still} style={styles.total} />
            </View>
          ) : <Text style={styles.total}>Pick dates</Text>}
          {reserved ? <Text style={styles.caption}>Confirmation sent</Text> : total && count ? <Text style={styles.caption}>{currency}{Math.round(total / count)} a night, taxes in</Text> : null}
        </View>
        <Button style={SELF.center} animated={animated} disabled={!from || !to || reserved} onPress={() => { if (from && to) { setReserved(true); onReserve?.({ from, to }, total) } }}>{reserved ? 'Reserved' : 'Reserve'}</Button>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.frame, borderWidth: 1, gap: space[3], padding: space[3], width: '100%' },
  head: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  heading: { alignItems: 'center' },
  title: type(16, c.textPrimary, '500'),
  caption: type(12, c.textTertiary),
  grid: { gap: space[0.5] },
  week: { flexDirection: 'row', gap: space[0.5] },
  weekday: { ...type(12, c.textTertiary, '400', true), flex: 1, paddingVertical: space[1], textAlign: 'center' },
  blank: { flex: 1 },
  night: { alignItems: 'center', borderColor: 'transparent', borderRadius: radius.control, borderWidth: 1.5, flex: 1, height: 52, justifyContent: 'center' },
  nightInside: { backgroundColor: c.ink5, borderRadius: 0 },
  nightEnd: { backgroundColor: c.inverse },
  nightRefused: { borderColor: c.danger },
  date: type(15, c.textPrimary, '500'),
  dateBooked: { color: c.textTertiary, textDecorationLine: 'line-through' },
  price: type(12, c.textTertiary, '500'),
  priceLow: { color: c.success },
  onInk: { color: c.textInverse },
  onInkSoft: { color: c.textInverse, opacity: 0.7 },
  note: { minHeight: 18, paddingHorizontal: space[2] },
  noteText: type(14, c.textSecondary),
  refused: type(14, c.danger),
  foot: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingBottom: space[2], paddingHorizontal: space[2], paddingTop: space[1] },
  totalBox: { flexShrink: 1 },
  totalRow: { flexDirection: 'row' },
  total: type(16, c.textPrimary, '500'),
})
