import { useState, type Ref } from 'react'
import { StyleSheet, Text, TextInput, type StyleProp, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { useFieldControl } from './field'
import { useFocusRing } from './input'

const NEAR_LIMIT = 0.9
const LINE = 22
const MIN_HEIGHT = 92

export type TextareaProps = Omit<TextInputProps, 'style' | 'editable' | 'multiline' | 'numberOfLines'> & {
  invalid?: boolean
  disabled?: boolean
  required?: boolean
  /** Lines shown before it scrolls. */
  rows?: number
  /** Shows a mono count. It turns strong at 90% and danger past the limit. */
  limit?: number
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Multi line text with an optional character count. */
export function Textarea({ invalid, disabled, required, rows, limit, value, defaultValue, onChangeText, onFocus, onBlur, animated = true, style, ref, ...rest }: TextareaProps & { ref?: Ref<TextInputInstance> }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled, required })
  const [typed, setTyped] = useState((value ?? defaultValue ?? '').length)
  const [focused, setFocused] = useState(false)
  const length = value === undefined ? typed : value.length
  const near = limit ? length >= limit * NEAR_LIMIT : false
  const over = limit ? length > limit : false
  const ring = useFocusRing(focused, field.invalid || over, still)

  return (
    <Animated.View style={[styles.box, field.disabled && styles.disabled, ring, style]}>
      <TextInput
        {...rest}
        ref={ref}
        {...(value === undefined ? {} : { value })}
        {...(defaultValue === undefined ? {} : { defaultValue })}
        {...(rows === undefined ? {} : { numberOfLines: rows })}
        multiline
        accessibilityHint={rest.accessibilityHint ?? field.hint}
        aria-disabled={field.disabled}
        editable={!field.disabled}
        placeholderTextColor={colors.textTertiary}
        style={[styles.entry, rows !== undefined && { minHeight: rows * LINE }]}
        textAlignVertical="top"
        onBlur={(e) => { setFocused(false); field.onBlur?.(); onBlur?.(e) }}
        onChangeText={(next) => { setTyped(next.length); onChangeText?.(next) }}
        onFocus={(e) => { setFocused(true); field.onFocus?.(); onFocus?.(e) }}
      />
      {limit ? (
        <Text
          accessibilityLabel={over ? 'Over the limit' : `${limit - length} characters left`}
          accessibilityLiveRegion={near ? 'polite' : 'none'}
          style={[styles.count, near && styles.near, over && styles.over]}
        >
          {length}/{limit}
        </Text>
      ) : null}
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { borderRadius: radius['2xl'], minHeight: 132, paddingBottom: space[6], paddingHorizontal: space[3.5], paddingTop: space[3], width: '100%' },
  disabled: { opacity: 0.5 },
  entry: { color: c.textPrimary, fontFamily: font.sans, fontSize: 16, includeFontPadding: false, letterSpacing: font.tracking(16), lineHeight: LINE, minHeight: MIN_HEIGHT, padding: 0 },
  count: { ...type(10, c.textSecondary, '400', true), bottom: space[2], position: 'absolute', right: space[3] },
  near: { color: c.textPrimary },
  over: { color: c.danger },
})
