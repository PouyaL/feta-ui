import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ActionSheetIOS, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewInstance, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeOut, LinearTransition, ZoomIn, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import { currentState, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { useFieldControl } from './field'
import { useFocusRing } from './input'
import { Mark, iconFor } from './label'

const POP = { stiffness: 420, damping: 26, mass: 1 } as const
const JUMP = { stiffness: 500, damping: 34, mass: 1 } as const
const OPEN_MS = 180
const CLOSE_MS = 120
const LIST_HEIGHT = 322
const ROW = 44
const OUT = Easing.bezier(0.23, 1, 0.32, 1)

export type SelectOption = { value: string; label: string; icon?: ReactNode; disabled?: boolean }
export type SelectGroup = { label: string; options: SelectOption[] }

export type SelectProps = {
  /** A flat list, or groups with mono labels. */
  options: (SelectOption | SelectGroup)[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Pick several: chips sit in the field, checks in the list, and the list stays open. */
  multiple?: boolean
  values?: string[]
  defaultValues?: string[]
  onValuesChange?: (values: string[]) => void
  placeholder?: string
  /** `field` matches Input, `pill` sits inline in properties, `native` keeps the platform control. */
  kind?: 'field' | 'pill' | 'native'
  /** `trigger` lays the list over the trigger, with the chosen row on it. Default `below`. */
  align?: 'below' | 'trigger'
  /** Starts open, for a list shown in place. */
  defaultOpen?: boolean
  /** The list's tallest height, before it scrolls. */
  listHeight?: number
  /** A row under the list. Multiple gets the count and `clear`. */
  footer?: ReactNode | ((state: { count: number; clear: () => void }) => ReactNode)
  /** Leading icon on the `pill` trigger. */
  icon?: ReactNode
  invalid?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const isGroup = (entry: SelectOption | SelectGroup): entry is SelectGroup => 'options' in entry

/** Keeps a floating surface mounted through its exit, and drives it on the UI thread. */
export function usePresence(open: boolean, still: boolean): { mounted: boolean; shown: SharedValue<number> } {
  const [mounted, setMounted] = useState(open)
  const shown = useSharedValue(open ? 1 : 0)
  useEffect(() => {
    if (open) {
      setMounted(true)
      shown.value = still ? 1 : withSpring(1, POP)
      return
    }
    if (still) { shown.value = 0; setMounted(false); return }
    shown.value = withTiming(0, { duration: CLOSE_MS, easing: OUT }, (done) => { if (done) runOnJS(setMounted)(false) })
  }, [open, still, shown])
  return { mounted, shown }
}

const chipIn = ZoomIn.springify().stiffness(POP.stiffness).damping(POP.damping).mass(POP.mass).withInitialValues({ transform: [{ scale: 0.8 }] })
const chipMove = LinearTransition.springify().stiffness(POP.stiffness).damping(POP.damping).mass(POP.mass)

type Anchor = { x: number; y: number; width: number; height: number }

/**
 * The trigger's name and value. iOS and Android read the picked option as the combobox's value; the web has no value
 * text for a combobox (aria-valuetext is for ranges), so there the option joins the name.
 */
const comboboxName = (name: string | undefined, value: string | undefined): { accessibilityLabel?: string; 'aria-valuetext'?: string } => {
  if (Platform.OS === 'web') return name === undefined ? {} : { accessibilityLabel: value !== undefined && value !== name ? `${name}, ${value}` : name }
  return { ...(name === undefined ? {} : { accessibilityLabel: name }), ...(value === undefined ? {} : { 'aria-valuetext': value }) }
}

/** Choose one value from a list. The list grows out of the trigger and the highlight glides. */
export function Select({ options, value, defaultValue, onValueChange, multiple = false, values, defaultValues = [], onValuesChange, placeholder = 'Select', kind = 'field', align = 'below', defaultOpen = false, listHeight = LIST_HEIGHT, footer, icon, invalid, disabled, accessibilityLabel, renderIcon, animated = true, style }: SelectProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled })
  const screen = useWindowDimensions()
  const trigger = useRef<ViewInstance>(null)
  const rows = useRef<Record<string, { y: number; height: number }>>({})
  const [held, setHeld] = useState(defaultValue)
  const [heldMany, setHeldMany] = useState(defaultValues)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const [shift, setShift] = useState(0)
  const flat = useMemo(() => options.flatMap((entry) => (isGroup(entry) ? entry.options : [entry])), [options])
  const enabled = useMemo(() => flat.filter((option) => !option.disabled), [flat])
  const current = value ?? held
  const many = values ?? heldMany
  const selected = flat.find((option) => option.value === current)
  const { mounted, shown } = usePresence(open, still)
  const glideY = useSharedValue(0)
  const glideH = useSharedValue(ROW)
  const glideOn = useSharedValue(0)
  const turn = useSharedValue(open ? 0 : 180)
  const ring = useFocusRing(open, field.invalid, still, kind === 'pill' ? colors.surface : undefined)

  useEffect(() => {
    turn.value = still ? (open ? 0 : 180) : withTiming(open ? 0 : 180, { duration: OPEN_MS, easing: OUT })
  }, [open, still, turn])

  const { onFocus: fieldFocus, onBlur: fieldBlur } = field
  useEffect(() => {
    if (open) fieldFocus?.()
    else fieldBlur?.()
  }, [open, fieldFocus, fieldBlur])

  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  const panel = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.value), transform: [{ translateY: (1 - shown.value) * -4 }, { scale: 0.96 + shown.value * 0.04 }] }))
  const glide = useAnimatedStyle(() => ({ height: glideH.value, opacity: glideOn.value, transform: [{ translateY: glideY.value }] }))

  function show(): void {
    trigger.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height })
      setShift(0)
      setOpen(true)
    })
  }

  function setMany(next: string[]): void {
    setHeldMany(next)
    onValuesChange?.(next)
  }

  function choose(next: string): void {
    if (multiple) {
      setMany(many.includes(next) ? many.filter((v) => v !== next) : [...many, next])
      return
    }
    setHeld(next)
    onValueChange?.(next)
    setOpen(false)
  }

  function highlight(next: string): void {
    const row = rows.current[next]
    if (!row) return
    const first = glideOn.value === 0
    glideY.value = still || first ? row.y : withSpring(row.y, JUMP)
    glideH.value = still || first ? row.height : withSpring(row.height, JUMP)
    glideOn.value = 1
  }

  /** On iOS the platform sheet is the native control. Android has none in core, so it opens the list. */
  function openNative(): void {
    if (Platform.OS !== 'ios') { show(); return }
    const pickable = enabled
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...pickable.map((option) => option.label), 'Cancel'], cancelButtonIndex: pickable.length, title: accessibilityLabel ?? placeholder },
      (index) => { const pick = pickable[index]; if (pick) choose(pick.value) },
    )
  }

  const row = (option: SelectOption): ReactNode => {
    const on = multiple ? many.includes(option.value) : option.value === current
    return (
      <Pressable
        key={option.value}
        accessibilityLabel={option.label}
        accessibilityRole="menuitem"
        {...currentState(on)}
        aria-disabled={Boolean(option.disabled)}
        disabled={option.disabled ?? false}
        style={[styles.item, option.disabled && styles.itemOff]}
        onLayout={(e) => {
          const { y, height } = e.nativeEvent.layout
          rows.current[option.value] = { y, height }
          if (align === 'trigger' && on && anchor) setShift(anchor.height / 2 - (y + height / 2))
        }}
        onPress={() => choose(option.value)}
        onPressIn={() => highlight(option.value)}
      >
        {option.icon ? <View style={styles.itemIcon}>{option.icon}</View> : null}
        <Text numberOfLines={1} style={[styles.itemText, on && styles.itemTextOn]}>{option.label}</Text>
        {on ? <Animated.View {...(still ? {} : { entering: ZoomIn.springify().stiffness(POP.stiffness).damping(POP.damping).mass(POP.mass).withInitialValues({ transform: [{ scale: 0.6 }] }) })}>{iconFor(renderIcon, 'tick-02', 16, colors.textPrimary)}</Animated.View> : null}
      </Pressable>
    )
  }

  const leading = icon ?? selected?.icon
  const below = anchor ? anchor.y + anchor.height + space[1.5] : 0
  const tall = Math.min(listHeight, flat.length * ROW) + space[4]
  const flip = anchor ? below + tall > screen.height - space[4] : false
  const footerNode = footer ? (typeof footer === 'function' ? footer({ count: many.length, clear: () => setMany([]) }) : footer) : null

  return (
    <View style={[kind === 'pill' ? styles.pillWrap : styles.select, style]}>
      <Pressable
        ref={trigger}
        collapsable={false}
        accessibilityHint={field.hint}
        {...comboboxName(accessibilityLabel ?? selected?.label ?? placeholder, selected?.label)}
        accessibilityRole="combobox"
        aria-disabled={field.disabled}
        aria-expanded={open}
        disabled={field.disabled}
        hitSlop={kind === 'pill' ? 6 : 0}
        onPress={() => { if (open) setOpen(false); else if (kind === 'native') openNative(); else show() }}
      >
        <Animated.View style={[styles.trigger, kind === 'pill' && styles.triggerPill, multiple && many.length > 0 && styles.triggerChips, field.disabled && styles.disabled, ring]}>
          {leading ? <View>{leading}</View> : null}
          {multiple && many.length ? (
            <View style={styles.chips}>
              {many.map((v) => {
                const name = flat.find((option) => option.value === v)?.label ?? v
                return (
                  <Animated.View key={v} {...(still ? {} : { entering: chipIn, exiting: FadeOut.duration(CLOSE_MS), layout: chipMove })} style={styles.chip}>
                    <Text style={styles.chipText}>{name}</Text>
                    <Pressable accessibilityLabel={`Remove ${name}`} accessibilityRole="button" hitSlop={14} onPress={() => setMany(many.filter((one) => one !== v))}>
                      {iconFor(renderIcon, 'x', 12, colors.textSecondary)}
                    </Pressable>
                  </Animated.View>
                )
              })}
            </View>
          ) : <Text numberOfLines={1} style={[styles.value, kind === 'pill' && styles.valuePill, !selected && styles.valueEmpty]}>{selected?.label ?? placeholder}</Text>}
          {multiple && many.length ? (
            <Pressable accessibilityLabel="Clear" accessibilityRole="button" hitSlop={14} onPress={() => setMany([])}>
              {iconFor(renderIcon, 'x', 16, colors.textSecondary)}
            </Pressable>
          ) : null}
          {field.invalid ? iconFor(renderIcon, 'alert-circle', 16, colors.danger) : null}
          {kind === 'native' ? (
            <View>
              <Mark name="chevron-up" size={12} color={colors.textSecondary} />
              <View style={styles.flipped}><Mark name="chevron-up" size={12} color={colors.textSecondary} /></View>
            </View>
          ) : (
            <Animated.View style={chevron}>{iconFor(renderIcon, 'chevron-up', 16, colors.textSecondary)}</Animated.View>
          )}
        </Animated.View>
      </Pressable>
      {defaultOpen && !anchor ? <View style={styles.probe} onLayout={show} /> : null}
      {mounted && anchor ? (
        <Modal transparent statusBarTranslucent visible animationType="none" onRequestClose={() => setOpen(false)}>
          <Pressable accessibilityLabel="Close" accessibilityRole="button" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <Animated.View
            style={[
              styles.panel,
              align === 'trigger' ? { top: anchor.y + shift } : flip ? { bottom: screen.height - anchor.y + space[1.5] } : { top: below },
              { left: anchor.x, minWidth: kind === 'pill' ? 180 : anchor.width },
              panel,
            ]}
          >
            <ScrollView accessibilityRole="list" bounces={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: listHeight }}>
              <View>
                <Animated.View pointerEvents="none" style={[styles.glide, glide]} />
                {options.map((entry) => (isGroup(entry) ? [<Text key={`group-${entry.label}`} style={styles.groupLabel}>{entry.label}</Text>, ...entry.options.map(row)] : row(entry)))}
              </View>
            </ScrollView>
            {footerNode ? <View style={styles.footer}>{footerNode}</View> : null}
          </Animated.View>
        </Modal>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  select: { width: '100%' },
  pillWrap: { alignSelf: 'flex-start' },
  trigger: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[2], height: 44, paddingLeft: space[4], paddingRight: space[3] },
  triggerPill: { height: 32, paddingHorizontal: space[2.5] },
  triggerChips: { height: undefined, minHeight: 44, paddingVertical: space[1] },
  disabled: { opacity: 0.5 },
  value: { ...type(16, c.textPrimary), flex: 1, minWidth: 0 },
  valueEmpty: { color: c.textTertiary },
  // The pill sizes to its label, so a zero flex basis would squeeze the label to nothing.
  valuePill: { flex: 0, flexShrink: 1 },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space[1], minWidth: 0 },
  chip: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', gap: space[1], paddingHorizontal: space[2], paddingVertical: space[0.5] },
  chipText: type(14, c.textPrimary, '500'),
  flipped: { transform: [{ rotate: '180deg' }] },
  probe: { height: 0 },
  panel: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, elevation: 8, padding: space[1], position: 'absolute', shadowColor: c.inverse, shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.12, shadowRadius: 24 },
  glide: { backgroundColor: c.ink5, borderRadius: radius.xl, left: 0, position: 'absolute', right: 0, top: 0 },
  item: { alignItems: 'center', borderRadius: radius.xl, flexDirection: 'row', gap: space[2], minHeight: ROW, paddingHorizontal: space[2.5], paddingVertical: space[2] },
  itemOff: { opacity: 0.4 },
  itemIcon: { flexShrink: 0 },
  itemText: { ...type(16, c.textPrimary), flex: 1 },
  itemTextOn: { fontWeight: '500' },
  groupLabel: { ...type(10, c.textTertiary, '400', true), paddingBottom: space[1], paddingHorizontal: space[2.5], paddingTop: space[2], textTransform: 'uppercase' },
  footer: { alignItems: 'center', borderTopColor: c.ink5, borderTopWidth: 1, flexDirection: 'row', gap: space[2], justifyContent: 'space-between', marginTop: space[1], paddingHorizontal: space[3], paddingVertical: space[1.5] },
})
