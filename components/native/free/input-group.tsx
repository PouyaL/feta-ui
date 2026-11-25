import { createContext, useContext, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { useFieldControl } from './field'
import { useFocusRing } from './input'

const LINE = 22
const MAX_LINES = 6
const GROW_MS = 120
const OUT = Easing.bezier(0.23, 1, 0.32, 1)

type GroupLink = { disabled: boolean; onFocus: () => void; onBlur: () => void; entry: { current: TextInputInstance | null } }

const GroupContext = createContext<GroupLink | null>(null)

export type InputGroupProps = {
  /** Inside the pill, before the value. */
  start?: ReactNode
  /** Inside the pill, after the value. */
  end?: ReactNode
  /** A row above the value. The pill becomes a radius 18 box. */
  blockStart?: ReactNode
  /** A row below the value. */
  blockEnd?: ReactNode
  invalid?: boolean
  disabled?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/** One control with addons inside the same ring. Focus and invalid belong to the whole group. */
export function InputGroup({ start, end, blockStart, blockEnd, invalid, disabled, animated = true, style, children }: InputGroupProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled })
  const entry = useRef<TextInputInstance | null>(null)
  const [focused, setFocused] = useState(false)
  const ring = useFocusRing(focused, field.invalid, still)
  const { onFocus: fieldFocus, onBlur: fieldBlur } = field
  const link = useMemo<GroupLink>(() => ({
    disabled: field.disabled,
    entry,
    onFocus: () => { setFocused(true); fieldFocus?.() },
    onBlur: () => { setFocused(false); fieldBlur?.() },
  }), [field.disabled, fieldFocus, fieldBlur])
  const block = Boolean(blockStart || blockEnd)
  const inline = (
    <>
      {start ? <View style={styles.addon}>{start}</View> : null}
      {children}
      {end ? <View style={styles.addon}>{end}</View> : null}
    </>
  )

  return (
    <GroupContext.Provider value={link}>
      <Pressable accessible={false} tabIndex={-1} disabled={field.disabled} onPress={() => entry.current?.focus()}>
        <Animated.View style={[block ? styles.box : styles.pill, !block && Boolean(end) && styles.withEnd, field.disabled && styles.disabled, ring, style]}>
          {block ? (
            <>
              {blockStart ? <View style={styles.blockRow}>{blockStart}</View> : null}
              <View style={styles.blockBody}>{inline}</View>
              {blockEnd ? <View style={styles.blockRow}>{blockEnd}</View> : null}
            </>
          ) : inline}
        </Animated.View>
      </Pressable>
    </GroupContext.Provider>
  )
}

type EntryOptions = { [K in 'disabled' | 'required' | 'onFocus' | 'onBlur']: InputGroupInputProps[K] | undefined }

function useEntry({ disabled, required, onFocus, onBlur }: EntryOptions) {
  const group = useContext(GroupContext)
  const field = useFieldControl({ disabled: disabled ?? group?.disabled, required })
  const handlers: Pick<TextInputProps, 'onFocus' | 'onBlur'> = {
    onFocus: (e) => { group?.onFocus(); onFocus?.(e) },
    onBlur: (e) => { group?.onBlur(); onBlur?.(e) },
  }
  return { group, field, handlers }
}

export type InputGroupInputProps = Omit<TextInputProps, 'editable'> & { disabled?: boolean; required?: boolean }

/** The value of an Input Group. */
export function InputGroupInput({ disabled, required, onFocus, onBlur, style, ref, ...rest }: InputGroupInputProps & { ref?: Ref<TextInputInstance> }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const { group, field, handlers } = useEntry({ disabled, required, onFocus, onBlur })
  const inner = useRef<TextInputInstance | null>(null)
  useImperativeHandle(ref, () => inner.current as TextInputInstance, [])
  return (
    <TextInput
      {...rest}
      {...handlers}
      ref={(node) => { inner.current = node; if (group) group.entry.current = node }}
      accessibilityLabel={rest.accessibilityLabel ?? rest['aria-label'] ?? field.label ?? rest.placeholder}
      accessibilityHint={rest.accessibilityHint ?? field.hint}
      aria-disabled={field.disabled}
      editable={!field.disabled}
      placeholderTextColor={colors.textTertiary}
      style={[styles.entry, style]}
    />
  )
}

export type InputGroupTextareaProps = InputGroupInputProps & { animated?: boolean }

/** A composer: it grows by a line at a time up to six, then scrolls. */
export function InputGroupTextarea({ disabled, required, onFocus, onBlur, onContentSizeChange, animated = true, style, ref, ...rest }: InputGroupTextareaProps & { ref?: Ref<TextInputInstance> }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const { group, field, handlers } = useEntry({ disabled, required, onFocus, onBlur })
  const inner = useRef<TextInputInstance | null>(null)
  const height = useSharedValue(LINE)
  const [scrolls, setScrolls] = useState(false)
  const grow = useAnimatedStyle(() => ({ height: height.value }))
  useImperativeHandle(ref, () => inner.current as TextInputInstance, [])

  return (
    <Animated.View style={[styles.composer, grow]}>
      <TextInput
        {...rest}
        {...handlers}
        ref={(node) => { inner.current = node; if (group) group.entry.current = node }}
        multiline
        accessibilityLabel={rest.accessibilityLabel ?? rest['aria-label'] ?? field.label ?? rest.placeholder}
      accessibilityHint={rest.accessibilityHint ?? field.hint}
        aria-disabled={field.disabled}
        editable={!field.disabled}
        placeholderTextColor={colors.textTertiary}
        scrollEnabled={scrolls}
        style={[styles.composerEntry, style]}
        textAlignVertical="top"
        onContentSizeChange={(e) => {
          const lines = Math.round(e.nativeEvent.contentSize.height / LINE)
          const next = Math.min(MAX_LINES, Math.max(1, lines)) * LINE
          setScrolls(lines > MAX_LINES)
          height.value = still ? next : withTiming(next, { duration: GROW_MS, easing: OUT })
          onContentSizeChange?.(e)
        }}
      />
    </Animated.View>
  )
}

/** Mono text for units and prefixes. */
export function InputGroupText({ children }: { children: ReactNode }) {
  const styles = useThemed(createStyles)
  return <Text style={styles.text}>{children}</Text>
}

/** A unit in a small 5% chip. */
export function InputGroupChip({ children }: { children: ReactNode }) {
  const styles = useThemed(createStyles)
  return <View style={styles.chip}><Text style={styles.chipText}>{children}</Text></View>
}

const createStyles = (c: Colors) => StyleSheet.create({
  pill: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[2], height: 48, paddingHorizontal: space[3] },
  withEnd: { paddingRight: space[1] },
  box: { borderRadius: radius.card, width: '100%' },
  disabled: { opacity: 0.5 },
  addon: { alignItems: 'center', flexDirection: 'row', flexShrink: 0, gap: space[1] },
  blockRow: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingHorizontal: space[3.5], paddingVertical: space[2.5] },
  blockBody: { alignItems: 'flex-start', flexDirection: 'row', gap: space[2], paddingHorizontal: space[3.5], paddingVertical: space[1.5] },
  entry: { color: c.textPrimary, flex: 1, fontFamily: font.sans, fontSize: 16, includeFontPadding: false, letterSpacing: font.tracking(16), minWidth: 0, paddingVertical: 0 },
  composer: { flex: 1, minWidth: 0, overflow: 'hidden' },
  composerEntry: { color: c.textPrimary, flex: 1, fontFamily: font.sans, fontSize: 16, includeFontPadding: false, letterSpacing: font.tracking(16), lineHeight: LINE, padding: 0 },
  text: type(12, c.textSecondary, '400', true),
  chip: { backgroundColor: c.ink5, borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: space[0.5] },
  chipText: type(12, c.textSecondary, '400', true),
})
