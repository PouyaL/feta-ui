import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react'
import { Pressable, StyleSheet, Text, TextInput, type TextInputInstance, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeOut, ZoomIn, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { useFieldControl } from './field'
import { IconButton } from './icon-button'
import { iconFor } from './label'

const COPIED_MS = 2000
const FOCUS_MS = 120
const FAST_MS = 150
const HEIGHT = { sm: 40, md: 48, lg: 56 } as const
const LEVELS = ['Weak', 'Fair', 'Good', 'Strong'] as const
const OUT = Easing.bezier(0.23, 1, 0.32, 1)

/** The ring every text control shares: it lifts onto the surface while active. */
export function useFocusRing(active: boolean, invalid: boolean, still: boolean, restColor?: string) {
  const colors = useColors()
  const focus = useSharedValue(active ? 1 : 0)
  useEffect(() => {
    const target = active ? 1 : 0
    focus.value = still ? target : withTiming(target, { duration: FOCUS_MS, easing: OUT })
  }, [active, still, focus])
  const { ink8, surface, textPrimary, danger } = colors
  const rest = restColor ?? colors.ink4
  return useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(focus.value, [0, 1], [rest, surface]),
    borderColor: invalid ? danger : interpolateColor(focus.value, [0, 1], [ink8, textPrimary]),
    borderWidth: invalid ? 1.5 : 1 + focus.value * 0.5,
  }))
}

export type InputProps = Omit<TextInputProps, 'style' | 'editable' | 'secureTextEntry' | 'keyboardType'> & {
  /** 40, 48, 56. Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url'
  invalid?: boolean
  disabled?: boolean
  required?: boolean
  /** Before the value: an icon, or a mono prefix. */
  leading?: ReactNode
  /** Adds a labelled copy button. Pair it with `onCopy`. */
  copyable?: boolean
  /** React Native ships no clipboard, so the app writes the text. */
  onCopy?: (value: string) => void | Promise<void>
  /** Password strength, 0 to 4. Shows the meter under the field. */
  strength?: number
  /** Overrides the keyboard `type` picks. */
  keyboardType?: TextInputProps['keyboardType']
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const KEYBOARDS = { text: 'default', password: 'default', email: 'email-address', number: 'numeric', tel: 'phone-pad', url: 'url' } as const

/** The single line text control: a pill that lifts onto the surface when focused. */
export function Input({ size = 'md', type: kind = 'text', invalid, disabled, required, leading, copyable, onCopy, strength, keyboardType, renderIcon, value, defaultValue, onChangeText, onFocus, onBlur, animated = true, style, ref, ...rest }: InputProps & { ref?: Ref<TextInputInstance> }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled, required })
  const inner = useRef<TextInputInstance>(null)
  const [typed, setTyped] = useState(defaultValue ?? '')
  const [focused, setFocused] = useState(false)
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)
  const ring = useFocusRing(focused, field.invalid, still)
  const password = kind === 'password'
  const hasEnd = password || copyable

  useImperativeHandle(ref, () => inner.current as TextInputInstance, [])

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy(): Promise<void> {
    await onCopy?.(value ?? typed)
    setCopied(true)
  }

  return (
    <View style={[styles.wrap, style]}>
      <Pressable accessible={false} tabIndex={-1} disabled={field.disabled} hitSlop={2} onPress={() => inner.current?.focus()}>
        <Animated.View style={[styles.pill, styles[size], hasEnd && styles.withEnd, field.disabled && styles.disabled, ring]}>
          {leading ? <View style={styles.leading}>{typeof leading === 'string' ? <Text style={styles.prefix}>{leading}</Text> : leading}</View> : null}
          <TextInput
            {...rest}
            ref={inner}
            {...(value === undefined ? {} : { value })}
            {...(defaultValue === undefined ? {} : { defaultValue })}
            accessibilityLabel={rest.accessibilityLabel ?? rest['aria-label'] ?? field.label ?? rest.placeholder}
            accessibilityHint={rest.accessibilityHint ?? field.hint}
            aria-disabled={field.disabled}
            editable={!field.disabled}
            keyboardType={keyboardType ?? KEYBOARDS[kind]}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry={password && !shown}
            style={[styles.entry, size === 'lg' && styles.entryLarge]}
            onBlur={(e) => { setFocused(false); field.onBlur?.(); onBlur?.(e) }}
            onChangeText={(next) => { setTyped(next); onChangeText?.(next) }}
            onFocus={(e) => { setFocused(true); field.onFocus?.(); onFocus?.(e) }}
          />
          {field.invalid ? (
            <Animated.View {...(still ? {} : { entering: ZoomIn.duration(FAST_MS).withInitialValues({ transform: [{ scale: 0.8 }] }), exiting: FadeOut.duration(FAST_MS) })}>
              {iconFor(renderIcon, 'alert-circle', 16, colors.danger)}
            </Animated.View>
          ) : null}
          {password ? <IconButton variant="ghost" size="sm" animated={animated} label={shown ? 'Hide password' : 'Show password'} disabled={field.disabled} icon={iconFor(renderIcon, shown ? 'eye-off' : 'eye', 16, colors.textSecondary)} onPress={() => setShown(!shown)} /> : null}
          {copyable ? <IconButton variant="ghost" size="sm" animated={animated} label={copied ? 'Copied' : 'Copy'} disabled={field.disabled} icon={iconFor(renderIcon, copied ? 'tick-02' : 'copy', 16, copied ? colors.success : colors.textSecondary)} onPress={() => void copy()} /> : null}
        </Animated.View>
      </Pressable>
      {strength === undefined ? null : (
        <View style={styles.meter}>
          <View style={styles.bars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {[1, 2, 3, 4].map((bar) => <View key={bar} style={[styles.bar, bar <= strength && (strength === 1 ? styles.barWeak : strength === 2 ? styles.barFair : styles.barStrong)]} />)}
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.level}>{strength > 0 ? LEVELS[strength - 1] : ''}</Text>
        </View>
      )}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  wrap: { gap: space[1.5], width: '100%' },
  pill: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[2], paddingHorizontal: space[3.5] },
  sm: { height: HEIGHT.sm },
  md: { height: HEIGHT.md },
  lg: { height: HEIGHT.lg },
  withEnd: { paddingRight: space[1] },
  disabled: { opacity: 0.5 },
  leading: { flexShrink: 0 },
  prefix: type(14, c.textSecondary, '400', true),
  entry: { color: c.textPrimary, flex: 1, fontFamily: font.sans, fontSize: 16, includeFontPadding: false, letterSpacing: font.tracking(16), minWidth: 0, paddingVertical: 0 },
  entryLarge: { fontSize: 17, letterSpacing: font.tracking(17) },
  meter: { alignItems: 'center', flexDirection: 'row', gap: space[2], paddingHorizontal: space[1] },
  bars: { flex: 1, flexDirection: 'row', gap: space[1] },
  bar: { backgroundColor: c.ink8, borderRadius: radius.full, flex: 1, height: 4 },
  barWeak: { backgroundColor: c.danger },
  barFair: { backgroundColor: c.textTertiary },
  barStrong: { backgroundColor: c.success },
  level: { ...type(12, c.textSecondary), minWidth: 42, textAlign: 'right' },
})
