import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, type TextInputInstance, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInUp, FadeOut, LinearTransition, ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { useFieldControl } from './field'
import { IconButton } from './icon-button'
import { useFocusRing } from './input'
import { iconFor } from './label'
import { Spinner } from './spinner'

const FAST_MS = 150
const BASE_MS = 200
const POP = { stiffness: 420, damping: 26, mass: 1 } as const
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)

export type ComboboxOption = { value: string; label: string; description?: string; avatar?: string; disabled?: boolean }

type Shared = {
  options: ComboboxOption[]
  placeholder?: string
  /** Remote lists: the spinner shows in the field and the list. */
  loading?: boolean
  /** What to show when nothing matches. */
  empty?: ReactNode
  invalid?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

export type ComboboxProps = Shared & (
  | { multiple?: false; value?: string | null; defaultValue?: string | null; onValueChange?: (value: string | null) => void; maxChips?: never }
  | { multiple: true; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void; /** Extra people fold into +N. */ maxChips?: number }
)

function Highlight({ text, query }: { text: string; query: string }) {
  const styles = useThemed(createStyles)
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return <>{text.slice(0, at)}<Text style={styles.match}>{text.slice(at, at + query.length)}</Text>{text.slice(at + query.length)}</>
}

const chipIn = ZoomIn.springify().stiffness(POP.stiffness).damping(POP.damping).mass(POP.mass).withInitialValues({ transform: [{ scale: 0.8 }] })
const chipMove = LinearTransition.springify().stiffness(POP.stiffness).damping(POP.damping).mass(POP.mass)
const listIn = FadeInUp.duration(BASE_MS).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: -4 }] })

/** An input that filters a list as you type. The list opens in place, so it stays reachable above the keyboard. */
export function Combobox(props: ComboboxProps) {
  const { options, placeholder = 'Search', loading, empty = 'No results', invalid, disabled, accessibilityLabel, renderIcon, animated = true, style } = props
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled })
  const input = useRef<TextInputInstance>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [heldOne, setHeldOne] = useState<string | null>(!props.multiple ? props.defaultValue ?? null : null)
  const [heldMany, setHeldMany] = useState<string[]>(props.multiple ? props.defaultValue ?? [] : [])
  const selected: string[] = props.multiple
    ? props.value ?? heldMany
    : [props.value === undefined ? heldOne : props.value].filter((v): v is string => Boolean(v))
  const single = !props.multiple ? options.find((o) => o.value === selected[0]) : undefined
  const typing = !single || query !== single.label
  const shown = useMemo(() => {
    if (!typing || !query) return options
    const q = query.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.description?.toLowerCase().includes(q))
  }, [options, query, typing])
  const ring = useFocusRing(open, field.invalid, still)
  const turn = useSharedValue(180)
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))

  useEffect(() => {
    turn.value = still ? (open ? 0 : 180) : withTiming(open ? 0 : 180, { duration: FAST_MS, easing: OUT })
  }, [open, still, turn])

  function close(): void {
    setOpen(false)
    setQuery('')
  }

  function emit(next: string[]): void {
    if (props.multiple) {
      setHeldMany(next)
      props.onValueChange?.(next)
    } else {
      const one = next[0] ?? null
      setHeldOne(one)
      props.onValueChange?.(one)
    }
  }

  function pick(option: ComboboxOption): void {
    if (option.disabled) return
    if (props.multiple) {
      emit(selected.includes(option.value) ? selected.filter((v) => v !== option.value) : [...selected, option.value])
      setQuery('')
      input.current?.focus()
    } else {
      emit([option.value])
      close()
      input.current?.blur()
    }
  }

  const limit = props.multiple ? props.maxChips ?? Infinity : Infinity
  const chips = props.multiple ? selected.slice(0, limit) : []
  const fold = props.multiple ? Math.max(0, selected.length - limit) : 0

  return (
    <View style={[styles.combobox, style]}>
      <Pressable accessible={false} disabled={field.disabled} onPress={() => input.current?.focus()}>
        <Animated.View style={[styles.field, field.disabled && styles.disabled, ring]}>
          {loading ? <Spinner size={16} label={null} color={colors.textSecondary} animated={animated} /> : iconFor(renderIcon, 'search', 16, colors.textSecondary)}
          {chips.map((value) => {
            const option = options.find((o) => o.value === value)
            const name = option?.label ?? value
            return (
              <Animated.View key={value} {...(still ? {} : { entering: chipIn, exiting: FadeOut.duration(FAST_MS), layout: chipMove })} style={styles.chip}>
                {option?.avatar ? <View style={styles.avatar}><Text style={styles.avatarText}>{option.avatar}</Text></View> : null}
                <Text style={styles.chipText}>{name}</Text>
                <Pressable accessibilityLabel={`Remove ${name}`} accessibilityRole="button" disabled={field.disabled} hitSlop={14} onPress={() => emit(selected.filter((v) => v !== value))}>
                  {iconFor(renderIcon, 'x', 12, colors.textSecondary)}
                </Pressable>
              </Animated.View>
            )
          })}
          {fold ? <View style={styles.more}><Text style={styles.moreText}>+{fold}</Text></View> : null}
          <TextInput
            ref={input}
            accessibilityHint={field.hint}
            accessibilityLabel={accessibilityLabel ?? placeholder}
            accessibilityRole="combobox"
            aria-disabled={field.disabled}
            aria-expanded={open}
            autoCorrect={false}
            editable={!field.disabled}
            placeholder={selected.length ? '' : placeholder}
            placeholderTextColor={colors.textTertiary}
            style={styles.entry}
            value={open || !single ? query : single.label}
            onBlur={() => { close(); field.onBlur?.() }}
            onChangeText={(next) => { setQuery(next); setOpen(true) }}
            onFocus={() => { setOpen(true); field.onFocus?.() }}
          />
          {!props.multiple && single ? (
            <IconButton variant="ghost" size="sm" animated={animated} label="Clear" disabled={field.disabled} icon={iconFor(renderIcon, 'x', 16, colors.textSecondary)} onPress={() => { emit([]); setQuery('') }} />
          ) : null}
          <Animated.View style={chevron}>{iconFor(renderIcon, 'chevron-up', 16, colors.textSecondary)}</Animated.View>
        </Animated.View>
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={styles.status}>{open ? `${shown.length} ${shown.length === 1 ? 'result' : 'results'}` : ''}</Text>
      {open ? (
        <Animated.View {...(still ? {} : { entering: listIn, exiting: FadeOut.duration(FAST_MS) })} style={styles.pop}>
          {shown.length ? (
            <ScrollView accessibilityRole="list" keyboardShouldPersistTaps="handled" style={styles.list}>
              {shown.map((option) => {
                const on = selected.includes(option.value)
                return (
                  <Pressable
                    key={option.value}
                    accessibilityLabel={option.label}
                    accessibilityRole="menuitem"
                    aria-selected={on}
                    aria-disabled={Boolean(option.disabled)}
                    disabled={option.disabled ?? false}
                    style={({ pressed }) => [styles.item, pressed && styles.itemPressed, option.disabled && styles.itemOff]}
                    onPress={() => pick(option)}
                  >
                    {option.avatar ? <View style={styles.avatarLarge}><Text style={styles.avatarText}>{option.avatar}</Text></View> : null}
                    <View style={styles.itemBody}>
                      <Text style={[styles.title, on && styles.titleOn]}><Highlight text={option.label} query={typing ? query : ''} /></Text>
                      {option.description ? <Text style={styles.description}>{option.description}</Text> : null}
                    </View>
                    {on ? iconFor(renderIcon, 'tick-02', 16, colors.textPrimary) : null}
                  </Pressable>
                )
              })}
            </ScrollView>
          ) : <Text style={styles.empty}>{loading ? 'Searching' : empty}</Text>}
        </Animated.View>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  combobox: { width: '100%' },
  field: { alignItems: 'center', borderRadius: radius.frame, flexDirection: 'row', flexWrap: 'wrap', gap: space[1], minHeight: 48, paddingHorizontal: space[3.5], paddingVertical: space[1.5] },
  disabled: { opacity: 0.5 },
  chip: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', gap: space[1], maxWidth: '100%', padding: space[1] },
  chipText: type(14, c.textPrimary, '500'),
  avatar: { alignItems: 'center', backgroundColor: c.ink10, borderRadius: radius.full, height: 20, justifyContent: 'center', width: 20 },
  avatarLarge: { alignItems: 'center', backgroundColor: c.ink10, borderRadius: radius.full, height: 28, justifyContent: 'center', width: 28 },
  avatarText: type(12, c.textPrimary, '500'),
  more: { backgroundColor: c.inverse, borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: space[0.5] },
  moreText: type(14, c.textInverse, '500'),
  entry: { color: c.textPrimary, flex: 1, fontFamily: font.sans, fontSize: 16, includeFontPadding: false, letterSpacing: font.tracking(16), minHeight: 32, minWidth: 80, paddingVertical: 0 },
  status: { height: 0, opacity: 0 },
  pop: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, marginTop: space[1.5], padding: space[1.5] },
  list: { maxHeight: 260 },
  item: { alignItems: 'center', borderRadius: radius.control, flexDirection: 'row', gap: space[2], minHeight: 44, paddingHorizontal: space[2.5], paddingVertical: space[2] },
  itemPressed: { backgroundColor: c.ink5 },
  itemOff: { opacity: 0.4 },
  itemBody: { flex: 1, minWidth: 0 },
  title: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  titleOn: { fontWeight: '600' },
  match: { fontWeight: '600' },
  description: type(12, c.textSecondary),
  empty: { ...type(14, c.textSecondary), paddingHorizontal: space[3], paddingVertical: space[4], textAlign: 'center' },
})
