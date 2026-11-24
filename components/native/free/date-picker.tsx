import { useMemo, useState, type ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors, hscroll } from '../kit'
import { Button } from './button'
import { Calendar, type DateRange } from './calendar'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { useFieldControl } from './field'
import { useFocusRing } from './input'
import { LabelSwap, iconFor } from './label'
import { usePresence } from './select'
import { TimeField } from './time-field'

const SHEET_TRAVEL = 40
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const shiftDay = (from: Date, add: number): Date => new Date(from.getFullYear(), from.getMonth(), from.getDate() + add)

/** Reads plain English dates: today, tomorrow, next friday, in 3 days, Nov 12, 12 November. */
export function parseDate(text: string, now: Date): Date | null {
  const input = text.trim().toLowerCase()
  if (!input) return null
  if (input === 'today') return shiftDay(now, 0)
  if (input === 'tomorrow') return shiftDay(now, 1)
  if (input === 'yesterday') return shiftDay(now, -1)
  const inDays = input.match(/^in (\d+) days?$/)
  if (inDays) return shiftDay(now, Number(inDays[1]))
  const inWeeks = input.match(/^in (\d+) weeks?$/)
  if (inWeeks) return shiftDay(now, Number(inWeeks[1]) * 7)
  const weekday = input.match(/^(next |this )?([a-z]+)$/)
  if (weekday) {
    const index = WEEKDAYS.findIndex((name) => name.startsWith(weekday[2] ?? '-') && (weekday[2]?.length ?? 0) >= 3)
    if (index >= 0) return shiftDay(now, (index - now.getDay() + 7) % 7 || 7)
  }
  const monthFirst = input.match(/^([a-z]{3})[a-z]* (\d{1,2})(?:,? (\d{4}))?$/)
  const dayFirst = input.match(/^(\d{1,2}) ([a-z]{3})[a-z]*(?:,? (\d{4}))?$/)
  const parts = monthFirst ? [monthFirst[1], monthFirst[2], monthFirst[3]] : dayFirst ? [dayFirst[2], dayFirst[1], dayFirst[3]] : null
  if (parts) {
    const month = MONTHS.indexOf(parts[0] ?? '')
    if (month >= 0) {
      const date = new Date(Number(parts[2] ?? now.getFullYear()), month, Number(parts[1]))
      if (date.getMonth() === month) return date
    }
  }
  return null
}

type Shared = {
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  defaultMonth?: Date
  isDisabled?: (date: Date) => boolean
  booked?: Date[]
  locale?: string
  /** Month and year selects replace the title. */
  dropdowns?: boolean
  accessibilityLabel?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

export type DatePickerProps = Shared & (
  | {
      mode?: 'single'
      value?: Date | null
      defaultValue?: Date | null
      onValueChange?: (value: Date | null) => void
      presets?: never
      /** Adds a time row under the month. Past days are disabled. */
      withTime?: boolean
      time?: string
      defaultTime?: string
      onTimeChange?: (time: string) => void
      /** The field takes typed dates like "next friday", and reads them back underneath. */
      natural?: boolean
    }
  | { mode: 'range'; value?: DateRange | null; defaultValue?: DateRange | null; onValueChange?: (value: DateRange | null) => void; /** Quick picks above the month, in days back from today. */ presets?: { label: string; days: number }[]; withTime?: never; time?: never; defaultTime?: never; onTimeChange?: never; natural?: never }
)

/** A pill field that opens a month in a sheet from the bottom edge. */
export function DatePicker(props: DatePickerProps) {
  const { placeholder = 'Pick a date', invalid, disabled, defaultMonth, isDisabled, booked, locale = 'en-US', dropdowns = false, accessibilityLabel, renderIcon, animated = true, style } = props
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled })
  const single = props.mode === 'range' ? null : props
  const ranged = props.mode === 'range' ? props : null
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [heldDate, setHeldDate] = useState<Date | null>(single?.defaultValue ?? null)
  const [heldRange, setHeldRange] = useState<DateRange | null>(ranged?.defaultValue ?? null)
  const [heldTime, setHeldTime] = useState(single?.defaultTime ?? '')
  const [typed, setTyped] = useState('')
  const format = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }), [locale])
  const { mounted, shown } = usePresence(open, still)
  const ring = useFocusRing(open || focused, field.invalid, still)
  const sheet = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value), transform: [{ translateY: (1 - shown.value) * SHEET_TRAVEL }] }))
  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value) }))

  const done = (): void => setOpen(false)
  const pastOff = (date: Date): boolean => {
    const now = new Date()
    return date < new Date(now.getFullYear(), now.getMonth(), now.getDate()) || Boolean(isDisabled?.(date))
  }
  const shared = {
    ...(single?.withTime ? { isDisabled: pastOff } : isDisabled ? { isDisabled } : {}),
    ...(booked ? { booked } : {}),
    ...(renderIcon ? { renderIcon } : {}),
    locale,
    dropdowns,
    animated,
  }
  let text: string | null
  let picker: ReactNode

  if (ranged) {
    const value = ranged.value === undefined ? heldRange : ranged.value
    text = value ? `${format.format(value.start)}${value.end ? ` to ${format.format(value.end)}` : ''}` : null
    const set = (next: DateRange | null): void => { setHeldRange(next); ranged.onValueChange?.(next) }
    const month = defaultMonth ?? value?.start
    picker = (
      <>
        {ranged.presets ? (
          <ScrollView style={hscroll} horizontal accessibilityLabel="Quick picks" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
            {ranged.presets.map((preset) => (
              <Button
                key={preset.label}
                size="sm"
                variant="ghost"
                animated={animated}
                onPress={() => {
                  const end = new Date()
                  set({ start: new Date(end.getFullYear(), end.getMonth(), end.getDate() - preset.days), end })
                  done()
                }}
              >
                {preset.label}
              </Button>
            ))}
          </ScrollView>
        ) : null}
        <Calendar {...shared} {...(month ? { defaultMonth: month } : {})} mode="range" value={value} onValueChange={set} onApply={done} />
      </>
    )
  } else {
    const value = single?.value === undefined ? heldDate : single.value
    const time = single?.time ?? heldTime
    const withTime = Boolean(single?.withTime)
    text = value ? `${format.format(value)}${withTime && time ? ` at ${time}` : ''}` : null
    const month = defaultMonth ?? value
    picker = (
      <>
        <Calendar {...shared} {...(month ? { defaultMonth: month } : {})} value={value} onValueChange={(next) => { setHeldDate(next); single?.onValueChange?.(next); if (!withTime) done() }} />
        {withTime ? (
          <View style={styles.timeRow}>
            <TimeField defaultValue={time || null} animated={animated} {...(renderIcon ? { renderIcon } : {})} style={styles.time} onValueChange={(next) => { const out = next ?? ''; setHeldTime(out); single?.onTimeChange?.(out) }} />
            <Button size="sm" animated={animated} disabled={!value || !time} onPress={done}>Done</Button>
          </View>
        ) : null}
      </>
    )
  }

  if (single?.natural) {
    const value = single.value === undefined ? heldDate : single.value
    const read = (raw: string): void => {
      setTyped(raw)
      const next = parseDate(raw, new Date())
      if (next) { setHeldDate(next); single.onValueChange?.(next) }
    }
    const parsed = typed ? parseDate(typed, new Date()) : value
    return (
      <View style={[styles.picker, style]}>
        <Animated.View style={[styles.pill, field.disabled && styles.disabled, ring]}>
          {iconFor(renderIcon, 'calendar', 16, colors.textSecondary)}
          <TextInput
            accessibilityHint={field.hint}
            accessibilityLabel={accessibilityLabel ?? placeholder}
            autoCorrect={false}
            editable={!field.disabled}
            placeholder="Try next friday"
            placeholderTextColor={colors.textTertiary}
            style={styles.entry}
            value={typed}
            onBlur={() => { setFocused(false); field.onBlur?.() }}
            onChangeText={read}
            onFocus={() => { setFocused(true); field.onFocus?.() }}
          />
        </Animated.View>
        <View accessibilityLiveRegion="polite" style={styles.readBack}>
          {typed && !parsed
            ? <Text style={styles.readText}>That is not a date yet</Text>
            : parsed ? <LabelSwap swapKey={parsed.toDateString()} still={still} style={styles.readText}>{format.format(parsed)}</LabelSwap> : null}
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.picker, style]}>
      <Pressable
        accessibilityHint={field.hint}
        accessibilityLabel={accessibilityLabel ?? text ?? placeholder}
        accessibilityRole="button"
        aria-disabled={field.disabled}
        aria-expanded={open}
        disabled={field.disabled}
        onPress={() => setOpen(!open)}
      >
        <Animated.View style={[styles.pill, field.disabled && styles.disabled, ring]}>
          {iconFor(renderIcon, 'calendar', 16, colors.textSecondary)}
          <View style={styles.value}>
            <LabelSwap swapKey={text ?? ''} still={still} style={[styles.valueText, !text && styles.valueEmpty]}>{text ?? placeholder}</LabelSwap>
          </View>
          {field.invalid ? iconFor(renderIcon, 'alert-circle', 16, colors.danger) : null}
        </Animated.View>
      </Pressable>
      {mounted ? (
        <Modal transparent statusBarTranslucent visible animationType="none" onRequestClose={done}>
          <Animated.View style={[styles.scrim, scrim]}>
            <Pressable accessibilityLabel="Close" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={done} />
          </Animated.View>
          <Animated.View accessibilityLabel={accessibilityLabel ?? 'Choose a date'} accessibilityViewIsModal style={[styles.sheet, sheet]}>
            {picker}
          </Animated.View>
        </Modal>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  picker: { width: '100%' },
  pill: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[2], height: 48, paddingHorizontal: space[3.5] },
  disabled: { opacity: 0.5 },
  value: { flex: 1, minWidth: 0, overflow: 'hidden' },
  valueText: type(16, c.textPrimary),
  valueEmpty: { color: c.textTertiary },
  entry: { color: c.textPrimary, flex: 1, fontFamily: font.sans, fontSize: 16, includeFontPadding: false, letterSpacing: font.tracking(16), minWidth: 0, paddingVertical: 0 },
  readBack: { marginTop: space[1.5], minHeight: 16, paddingHorizontal: space[1] },
  readText: type(12, c.textSecondary),
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: c.ink10 },
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, bottom: 0, gap: space[2], left: 0, paddingBottom: space[8], paddingHorizontal: space[2], paddingTop: space[3], position: 'absolute', right: 0 },
  presets: { gap: space[1], paddingHorizontal: space[1] },
  timeRow: { alignItems: 'flex-start', flexDirection: 'row', gap: space[2], paddingHorizontal: space[3], paddingVertical: space[2] },
  time: { flex: 1, width: undefined },
})
