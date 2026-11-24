import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { iconFor } from './label'

const POP = { stiffness: 420, damping: 26, mass: 1 } as const
const RIPPLE_MS = 400
const SQUEEZE_IN_MS = 80
const SQUEEZE_OUT_MS = 320
const OUT = Easing.bezier(0.23, 1, 0.32, 1)

type MarkProps = { checked: boolean; invalid: boolean; disabled: boolean; pressed: boolean; pulse: number; still: boolean }

/** The ring and dot alone, so a whole row or card can be the one target. */
function RadioMark({ checked, invalid, disabled, pressed, pulse, still }: MarkProps) {
  const styles = useThemed(createStyles)
  const dot = useSharedValue(checked ? 1 : 0)
  const squeeze = useSharedValue(1)
  const ripple = useSharedValue(1)
  const halo = useSharedValue(0)

  useEffect(() => {
    dot.value = still ? (checked ? 1 : 0) : withSpring(checked ? 1 : 0, POP)
  }, [checked, still, dot])

  useEffect(() => {
    halo.value = pressed && !disabled ? 1 : 0
  }, [pressed, disabled, halo])

  // The press path for what hover shows on Web: a squeeze and one ring leaving the control.
  useEffect(() => {
    if (!pulse || still) return
    squeeze.value = withSequence(withTiming(0.86, { duration: SQUEEZE_IN_MS, easing: OUT }), withTiming(1, { duration: SQUEEZE_OUT_MS, easing: OUT }))
    ripple.value = 0
    ripple.value = withTiming(1, { duration: RIPPLE_MS, easing: OUT })
  }, [pulse, still, squeeze, ripple])

  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: Math.max(0, dot.value) }] }))
  const controlStyle = useAnimatedStyle(() => ({ transform: [{ scale: squeeze.value }] }))
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }))
  const rippleStyle = useAnimatedStyle(() => ({ opacity: 1 - ripple.value, transform: [{ scale: 0.74 + ripple.value * 0.26 }] }))

  return (
    <View style={[styles.radio, disabled && styles.dimmed]}>
      <Animated.View style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.ripple, rippleStyle]} />
      <Animated.View style={[styles.control, checked && styles.controlOn, invalid && styles.controlInvalid, invalid && checked && styles.controlInvalidOn, controlStyle]}>
        <Animated.View style={[styles.dot, dotStyle]} />
      </Animated.View>
    </View>
  )
}

function usePressMotion(disabled: boolean) {
  const [pressed, setPressed] = useState(false)
  const [pulse, setPulse] = useState(0)
  return {
    pressed,
    pulse,
    onPressIn: (): void => { if (disabled) return; setPressed(true); setPulse((n) => n + 1) },
    onPressOut: (): void => setPressed(false),
  }
}

export type RadioProps = {
  checked?: boolean
  invalid?: boolean
  disabled?: boolean
  onChange?: () => void
  accessibilityLabel?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A radio that feels alive: press squeezes and sends a ripple. */
export function Radio({ checked = false, invalid = false, disabled = false, onChange, accessibilityLabel, animated = true, style }: RadioProps) {
  const still = useStill(animated)
  const { pressed, pulse, onPressIn, onPressOut } = usePressMotion(disabled)
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radio"
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      hitSlop={11}
      style={style}
      onPress={onChange}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <RadioMark checked={checked} invalid={invalid} disabled={disabled} pressed={pressed} pulse={pulse} still={still} />
    </Pressable>
  )
}

export type RadioOption = { value: string; label: ReactNode; description?: ReactNode; icon?: ReactNode; meta?: ReactNode; disabled?: boolean }

export type RadioGroupProps = {
  /** The legend. */
  label: ReactNode
  options: RadioOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /** `card` makes the whole card the target. Default `list`. */
  variant?: 'list' | 'card'
  error?: ReactNode
  disabled?: boolean
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Option({ option, on, off, invalid, variant, still, onChoose }: { option: RadioOption; on: boolean; off: boolean; invalid: boolean; variant: 'list' | 'card'; still: boolean; onChoose: () => void }) {
  const styles = useThemed(createStyles)
  const { pressed, pulse, onPressIn, onPressOut } = usePressMotion(off)
  const mark = <RadioMark checked={on} invalid={invalid} disabled={off} pressed={pressed} pulse={pulse} still={still} />
  return (
    <Pressable
      accessibilityHint={typeof option.description === 'string' ? option.description : undefined}
      accessibilityLabel={typeof option.label === 'string' ? option.label : undefined}
      accessibilityRole="radio"
      aria-checked={on}
      aria-disabled={off}
      disabled={off}
      style={[variant === 'card' ? styles.optionCard : styles.option, variant === 'card' && on && styles.optionCardOn, off && styles.dimmed]}
      onPress={onChoose}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      {variant === 'list' ? mark : null}
      {option.icon ? <View style={styles.icon}>{option.icon}</View> : null}
      <View style={styles.text}>
        <Text style={styles.title}>{option.label}</Text>
        {option.description ? <Text style={styles.description}>{option.description}</Text> : null}
      </View>
      {option.meta ? <Text style={styles.meta}>{option.meta}</Text> : null}
      {variant === 'card' ? mark : null}
    </Pressable>
  )
}

/** Pick exactly one. */
export function RadioGroup({ label, options, value, defaultValue, onValueChange, variant = 'list', error, disabled = false, renderIcon, animated = true, style }: RadioGroupProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const current = value ?? held
  const invalid = Boolean(error)

  function choose(next: string): void {
    setHeld(next)
    onValueChange?.(next)
  }

  return (
    <View accessibilityRole="radiogroup" style={[styles.group, style]}>
      <Text accessibilityRole="header" style={styles.legend}>{label}</Text>
      <View style={styles.body}>
        {options.map((option) => (
          <Option key={option.value} option={option} on={option.value === current} off={disabled || Boolean(option.disabled)} invalid={invalid} variant={variant} still={still} onChoose={() => choose(option.value)} />
        ))}
      </View>
      {error ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.message}>
          {iconFor(renderIcon, 'alert-circle', 14, colors.danger)}
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  radio: { alignItems: 'center', height: 22, justifyContent: 'center', width: 22 },
  dimmed: { opacity: 0.5 },
  halo: { backgroundColor: c.ink8, borderRadius: radius.full, bottom: -8, left: -8, position: 'absolute', right: -8, top: -8 },
  ripple: { borderColor: c.ink10, borderRadius: radius.full, borderWidth: 1, bottom: -12, left: -12, position: 'absolute', right: -12, top: -12 },
  control: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.textTertiary, borderRadius: radius.full, borderWidth: 1.5, height: 22, justifyContent: 'center', width: 22 },
  controlOn: { backgroundColor: c.inverse, borderColor: c.inverse },
  controlInvalid: { borderColor: c.danger },
  controlInvalidOn: { backgroundColor: c.danger },
  dot: { backgroundColor: c.textInverse, borderRadius: radius.full, height: 8, width: 8 },
  group: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1] },
  legend: { ...type(16, c.textPrimary, '500'), paddingHorizontal: space[3], paddingVertical: space[2] },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[1], padding: space[1] },
  option: { alignItems: 'flex-start', borderRadius: radius.xl, flexDirection: 'row', gap: space[2.5], minHeight: 44, paddingHorizontal: space[2.5], paddingVertical: space[2] },
  optionCard: { alignItems: 'center', borderColor: c.ink8, borderRadius: radius['2xl'], borderWidth: 1, flexDirection: 'row', gap: space[2.5], minHeight: 44, paddingHorizontal: space[4], paddingVertical: space[3.5] },
  optionCardOn: { backgroundColor: c.ink4, borderColor: c.textPrimary, borderWidth: 1.5 },
  icon: { flexShrink: 0 },
  text: { flex: 1, minWidth: 0 },
  title: type(15, c.textPrimary, '500'),
  description: { ...type(14, c.textSecondary), lineHeight: 20 },
  meta: { ...type(14, c.textSecondary, '500'), flexShrink: 0 },
  message: { alignItems: 'center', flexDirection: 'row', gap: space[1], paddingHorizontal: space[3], paddingVertical: space[2] },
  error: { ...type(12, c.danger), flexShrink: 1 },
})
