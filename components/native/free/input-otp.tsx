import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { Pressable, StyleSheet, TextInput, type TextInputInstance, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, cancelAnimation } from 'react-native-reanimated'
import { font, radius, space, type Colors } from '../kit'
import { useStill, useThemed } from './card'
import { useFieldControl } from './field'

const FOCUS_MS = 120
const PASTE_STAGGER_MS = 40
const BLINK_MS = 500
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)

const PATTERNS = {
  'six-digits': { length: 6, accept: /[0-9]/g, keyboard: 'number-pad', masked: false, split: 3 },
  'four-pin': { length: 4, accept: /[0-9]/g, keyboard: 'number-pad', masked: true, split: 0 },
  alphanumeric: { length: 6, accept: /[0-9a-z]/gi, keyboard: 'default', masked: false, split: 0 },
} as const

export type InputOTPProps = {
  /** Six digits split 3 and 3, a masked PIN, or letters and digits. Default `six-digits`. */
  pattern?: keyof typeof PATTERNS
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** Fires on the last character, typed or pasted. */
  onComplete?: (value: string) => void
  invalid?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Caret() {
  const styles = useThemed(createStyles)
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(1, { duration: BLINK_MS }), withTiming(0, { duration: 0 }), withTiming(0, { duration: BLINK_MS }), withTiming(1, { duration: 0 })), -1)
    return () => cancelAnimation(opacity)
  }, [opacity])
  const blink = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[styles.caret, blink]} />
}

/** Separate slots that behave like one input: one real field, with autofill and paste. */
export function InputOTP({ pattern = 'six-digits', value, defaultValue = '', onValueChange, onComplete, invalid, disabled, accessibilityLabel = 'One time code', animated = true, style, ref }: InputOTPProps & { ref?: Ref<TextInputInstance> }) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled })
  const spec = PATTERNS[pattern]
  const input = useRef<TextInputInstance>(null)
  const [held, setHeld] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const [pasted, setPasted] = useState(false)
  const code = (value ?? held).slice(0, spec.length)

  useImperativeHandle(ref, () => input.current as TextInputInstance, [])

  function commit(raw: string): void {
    const next = (raw.match(spec.accept) ?? []).join('').slice(0, spec.length)
    const clean = pattern === 'alphanumeric' ? next.toUpperCase() : next
    if (clean === code) return
    // More than one new character at once can only be a paste or autofill.
    setPasted(clean.length - code.length > 1)
    setHeld(clean)
    onValueChange?.(clean)
    if (clean.length === spec.length) onComplete?.(clean)
  }

  return (
    <Pressable accessible={false} disabled={field.disabled} style={[styles.otp, field.disabled && styles.disabled, style]} onPress={() => input.current?.focus()}>
      {Array.from({ length: spec.length }, (_, i) => {
        const char = code[i]
        const active = focused && i === Math.min(code.length, spec.length - 1)
        const enter = FadeInUp.duration(FOCUS_MS).delay(pasted ? i * PASTE_STAGGER_MS : 0).easing(OUT).withInitialValues({ opacity: 0, transform: [{ translateY: -6 }] })
        return (
          <View key={i} style={styles.group}>
            {spec.split && i === spec.split ? <View style={styles.separator} /> : null}
            <View style={[styles.slot, active && styles.slotActive, field.invalid && styles.slotInvalid]}>
              {char ? (
                <Animated.Text key={char} {...(still ? {} : { entering: enter })} style={[styles.char, field.invalid && styles.charInvalid]}>
                  {spec.masked ? '•' : char}
                </Animated.Text>
              ) : null}
              {focused && i === code.length ? (still ? <View style={styles.caret} /> : <Caret />) : null}
            </View>
          </View>
        )
      })}
      <TextInput
        ref={input}
        accessibilityHint={field.hint}
        accessibilityLabel={accessibilityLabel}
        aria-disabled={field.disabled}
        autoComplete={spec.keyboard === 'number-pad' ? 'sms-otp' : 'off'}
        caretHidden
        editable={!field.disabled}
        keyboardType={spec.keyboard}
        maxLength={spec.length}
        secureTextEntry={spec.masked}
        style={styles.entry}
        textContentType="oneTimeCode"
        value={code}
        onBlur={() => { setFocused(false); field.onBlur?.() }}
        onChangeText={commit}
        onFocus={() => { setFocused(true); field.onFocus?.() }}
      />
    </Pressable>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  otp: { alignSelf: 'flex-start', flexDirection: 'row', gap: space[1.5], maxWidth: '100%' },
  disabled: { opacity: 0.5 },
  entry: { ...StyleSheet.absoluteFill, color: 'transparent', fontSize: 16, opacity: 0.02 },
  group: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[1.5] },
  separator: { backgroundColor: c.ink10, borderRadius: radius.full, height: 2, width: 14 },
  slot: { alignItems: 'center', backgroundColor: c.ink4, borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, flexShrink: 1, height: 56, justifyContent: 'center', width: 46 },
  slotActive: { backgroundColor: c.surface, borderColor: c.textPrimary, borderWidth: 1.5 },
  slotInvalid: { borderColor: c.danger, borderWidth: 1.5 },
  char: { color: c.textPrimary, fontFamily: font.mono, fontSize: 22, lineHeight: 28 },
  charInvalid: { color: c.danger },
  caret: { backgroundColor: c.textPrimary, height: 22, width: 2 },
})
