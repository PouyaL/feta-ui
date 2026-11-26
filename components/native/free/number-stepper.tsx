import { useMemo, useState, type ReactNode } from 'react'
import { View, Text, Pressable, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeInDown } from 'react-native-reanimated'
import { font, press, radius, useColors, useReduceMotion, type Colors } from '../kit'

export type NumberStepperProps = {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** What is being counted. Names the group and both buttons. */
  label: string
  disabled?: boolean
  animated?: boolean
  renderIcon?: RenderIcon | undefined
  style?: StyleProp<ViewStyle>
}

/** Minus, value and plus inside a 1 px 10% ink ring, 118 by 42 on Mobile. Minus turns off at `min`, plus at `max`. */
export function NumberStepper({ value, defaultValue = 1, onValueChange, min = 0, max = 999, step = 1, label, disabled = false, animated = true, renderIcon, style }: NumberStepperProps) {
  const styles = useStyles()
  const c = useColors()
  const reduce = useReduceMotion()
  const [own, setOwn] = useState(defaultValue)
  const current = value ?? own
  const change = (next: number): void => {
    const clamped = Math.min(max, Math.max(min, next))
    if (value === undefined) setOwn(clamped)
    onValueChange?.(clamped)
  }
  return (
    <View accessibilityLabel={label} style={[styles.stepper, disabled && styles.off, style]}>
      <IconPress label={`Fewer ${label.toLowerCase()}`} disabled={disabled || current <= min} onPress={() => change(current - step)} animated={animated}><Icon name="minus" size={16} color={c.textSecondary} render={renderIcon} /></IconPress>
      <View accessibilityLiveRegion="polite" style={styles.value}><Rolling value={String(current)} still={!animated || reduce} style={styles.number} /></View>
      <IconPress label={`More ${label.toLowerCase()}`} disabled={disabled || current >= max} onPress={() => change(current + step)} animated={animated}><Icon name="plus" size={16} color={c.textSecondary} render={renderIcon} /></IconPress>
    </View>
  )
}

/** Draws a fetaUI icon by name. This file asks for: minus, plus. Left out, plain text glyphs stand in. */
export type RenderIcon = (name: string, size: number, color: string) => ReactNode

const GLYPHS: Record<string, string> = { 'minus': '−', 'plus': '+' }

function Icon({ name, size, color, render }: { name: string; size: number; color: string; render: RenderIcon | undefined }) {
  const styles = useStyles()
  if (render) return <>{render(name, size, color)}</>
  const glyph = GLYPHS[name]
  return glyph ? <Text accessible={false} style={[styles.glyph, { color, fontSize: size, lineHeight: size + 2 }]}>{glyph}</Text> : null
}

/** A 36 px ghost icon button that reaches 44 px through its hit slop. Presses to 0.98. */
function IconPress({ label, disabled = false, onPress, animated, children }: { label: string; disabled?: boolean; onPress?: (() => void) | undefined; animated: boolean; children: ReactNode }) {
  const styles = useStyles()
  const reduce = useReduceMotion()
  const scale = useSharedValue(1)
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const springTo = (to: number): void => {
    if (animated && !reduce) scale.value = withSpring(to, press.spring)
  }
  return (
    <AnimatedPressable accessibilityRole="button" accessibilityLabel={label} aria-disabled={disabled} disabled={disabled} hitSlop={4} onPress={onPress} onPressIn={() => springTo(press.scale)} onPressOut={() => springTo(1)} style={[styles.iconPress, disabled && styles.iconPressOff, pressed]}>
      {children}
    </AnimatedPressable>
  )
}

const ROLL_MS = 200

/** Each changed character rolls in from below. */
function Rolling({ value, still, style }: { value: string; still: boolean; style: StyleProp<TextStyle> }) {
  const styles = useStyles()
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={value} style={styles.rolling}>
      {Array.from(value, (char, i) => <Animated.Text key={`${i}-${char}`} {...(still ? {} : { entering: FadeInDown.duration(ROLL_MS) })} style={style}>{char}</Animated.Text>)}
    </View>
  )
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

const useStyles = () => {
  const colors = useColors()
  return useMemo(() => createStyles(colors), [colors])
}

const text = (size: number, lineHeight: number, weight: TextStyle['fontWeight'] = '400'): TextStyle => ({ fontFamily: font.sans, fontSize: size, lineHeight, fontWeight: weight, letterSpacing: font.tracking(size) })

const createStyles = (c: Colors) => StyleSheet.create({
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 4, padding: 2, borderRadius: radius.full, borderWidth: 1, borderColor: c.ink10 },
  off: { opacity: 0.5 },
  value: { alignItems: 'center', width: 32 },
  number: { ...text(14, 20, '500'), fontVariant: ['tabular-nums'], color: c.textPrimary },
  glyph: { fontFamily: font.sans, textAlign: 'center' },
  iconPress: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: radius.full },
  iconPressOff: { opacity: 0.5 },
  rolling: { flexDirection: 'row', overflow: 'hidden' },
})
