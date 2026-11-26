import { useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type AccessibilityActionEvent, type StyleProp, type TextInputInstance, type TextInputKeyPressEvent, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInUp, FadeOut } from 'react-native-reanimated'
import { currentState, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { useFieldControl } from './field'
import { useFocusRing } from './input'
import { RollingText, iconFor } from './label'

const MESSAGE_MS = 180
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const messageIn = FadeInUp.duration(MESSAGE_MS).easing(OUT).withInitialValues({ opacity: 0, transform: [{ translateY: -4 }] })

type Parts = { hour: number | null; minute: number | null; period: 'AM' | 'PM' | null }
type Segment = keyof Parts

export type TimeFieldProps = {
  /** 24 hour text, like 09:30. */
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string | null) => void
  /** Earliest and latest times, as 24 hour text. Outside them, the field turns invalid. */
  min?: string
  max?: string
  /** Replaces the out of range message. */
  error?: ReactNode
  invalid?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const toParts = (text: string | null | undefined): Parts => {
  if (!text) return { hour: null, minute: null, period: null }
  const [h = 0, m = 0] = text.split(':').map(Number)
  return { hour: h % 12 || 12, minute: m, period: h >= 12 ? 'PM' : 'AM' }
}

const toText = ({ hour, minute, period }: Parts): string | null => {
  if (hour === null || minute === null || period === null) return null
  const h = (hour % 12) + (period === 'PM' ? 12 : 0)
  return `${String(h).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const pad = (value: number | null, blank: string): string => (value === null ? blank : String(value).padStart(2, '0'))

/** A segmented time input. A press picks a segment, and the number pad types into it. */
export function TimeField({ value, defaultValue = null, onValueChange, min, max, error, invalid, disabled, accessibilityLabel = 'Time', renderIcon, animated = true, style }: TimeFieldProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled })
  const keys = useRef<TextInputInstance>(null)
  const typed = useRef('')
  const [held, setHeld] = useState<Parts>(toParts(defaultValue))
  const [focus, setFocus] = useState<Segment | null>(null)
  const [overHour, setOverHour] = useState(false)
  const parts = value === undefined ? held : toParts(value)
  const text = toText(parts)
  const outside = Boolean(text && ((min && text < min) || (max && text > max)))
  const bad = field.invalid || outside || overHour
  const message = error ?? (overHour ? 'Hours run 1 to 12' : outside ? `Pick a time from ${min} to ${max}` : null)
  const ring = useFocusRing(focus !== null, bad, still)

  function set(next: Parts): void {
    setHeld(next)
    const out = toText(next)
    if (out) onValueChange?.(out)
  }

  function step(segment: Segment, by: number): void {
    setOverHour(false)
    if (segment === 'period') { set({ ...parts, period: parts.period === 'PM' ? 'AM' : 'PM' }); return }
    const size = segment === 'hour' ? 12 : 60
    const low = segment === 'hour' ? 1 : 0
    const now = parts[segment] ?? (by > 0 ? low + size - 1 : low)
    set({ ...parts, [segment]: ((now - low + by + size) % size) + low })
  }

  function select(segment: Segment): void {
    typed.current = ''
    if (segment === 'period') {
      keys.current?.blur()
      setFocus(null)
      step('period', 1)
      return
    }
    setFocus(segment)
    keys.current?.focus()
  }

  function onDigit(digit: string): void {
    if (focus !== 'hour' && focus !== 'minute') return
    const digits = `${typed.current}${digit}`
    const number = Number(digits)
    const top = focus === 'hour' ? 12 : 59
    if (focus === 'hour') setOverHour(number > top)
    if (number <= top && !(focus === 'hour' && number === 0)) set({ ...parts, [focus]: number })
    if (digits.length === 2 || number * 10 > top) {
      typed.current = ''
      if (focus === 'hour') setFocus('minute')
      else { keys.current?.blur(); setFocus(null) }
    } else typed.current = digits
  }

  function onKey(e: TextInputKeyPressEvent): void {
    if (e.nativeEvent.key !== 'Backspace' || !focus) return
    typed.current = ''
    set({ ...parts, [focus]: null })
  }

  const segment = (name: Segment, shown: string, title: string, low: number, high: number): ReactNode => {
    const on = focus === name
    const empty = parts[name] === null
    const part = parts[name]
    const now = part === null ? low : typeof part === 'number' ? part : part === 'PM' ? 1 : 0
    return (
      <Pressable
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityLabel={`${accessibilityLabel} ${title}`}
        accessibilityRole="adjustable"
        aria-disabled={field.disabled}
        {...currentState(on, 'true')}
        aria-valuemax={high}
        aria-valuemin={low}
        aria-valuenow={now}
        aria-valuetext={shown}
        disabled={field.disabled}
        hitSlop={9}
        style={[styles.segment, on && styles.segmentOn]}
        onAccessibilityAction={(e: AccessibilityActionEvent) => step(name, e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        onPress={() => select(name)}
      >
        {still || empty
          ? <Text style={[styles.digits, empty && !on && styles.digitsEmpty, on && styles.digitsOn]}>{shown}</Text>
          : <RollingText value={shown} still={still} style={[styles.digits, on && styles.digitsOn]} />}
      </Pressable>
    )
  }

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View accessibilityLabel={accessibilityLabel} style={[styles.field, field.disabled && styles.disabled, ring]}>
        <View style={styles.clock}>{iconFor(renderIcon, 'clock', 16, colors.textSecondary)}</View>
        {segment('hour', pad(parts.hour, 'hh'), 'hour', 1, 12)}
        <Text style={styles.colon}>:</Text>
        {segment('minute', pad(parts.minute, 'mm'), 'minute', 0, 59)}
        {segment('period', parts.period ?? 'AM', 'AM or PM', 0, 1)}
        <TextInput
          ref={keys}
          accessibilityElementsHidden
          importantForAccessibility="no"
          aria-label={`${accessibilityLabel} digits`}
          caretHidden
          keyboardType="number-pad"
          style={styles.keys}
          value=""
          onBlur={() => { setFocus(null); field.onBlur?.() }}
          onChangeText={(next) => { const digit = next.slice(-1); if (/\d/.test(digit)) onDigit(digit) }}
          onFocus={() => field.onFocus?.()}
          onKeyPress={onKey}
        />
      </Animated.View>
      {bad && message ? (
        <Animated.View {...(still ? {} : { entering: messageIn, exiting: FadeOut.duration(MESSAGE_MS) })} accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.message}>
          {iconFor(renderIcon, 'alert-circle', 14, colors.danger)}
          <Text style={styles.error}>{message}</Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  wrap: { gap: space[1.5], width: '100%' },
  field: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[0.5], height: 48, paddingHorizontal: space[3] },
  disabled: { opacity: 0.5 },
  clock: { marginRight: space[1.5] },
  segment: { alignItems: 'center', borderRadius: radius.lg, height: 26, justifyContent: 'center', minWidth: 26, paddingHorizontal: space[1] },
  segmentOn: { backgroundColor: c.inverse },
  digits: type(16, c.textPrimary, '400', true),
  digitsEmpty: { color: c.textTertiary },
  digitsOn: { color: c.textInverse },
  colon: type(16, c.textTertiary),
  keys: { height: 1, opacity: 0, position: 'absolute', width: 1 },
  message: { alignItems: 'center', flexDirection: 'row', gap: space[1], paddingHorizontal: space[1] },
  error: { ...type(12, c.danger), flexShrink: 1 },
})
