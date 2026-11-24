import { Children, Fragment, useEffect, useMemo, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { font, radius, space, useColors, useReduceMotion, type Colors } from '../kit'

const PRESS_MS = 60
const RELEASE_MS = 120
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const SOFT = Easing.bezier(0.22, 1, 0.36, 1)

const SPOKEN: Record<string, string> = {
  '⌘': 'Command', '⇧': 'Shift', '⌥': 'Option', '⌃': 'Control', '↵': 'Enter', '⌫': 'Backspace', '⇥': 'Tab', '⎋': 'Escape',
  '↑': 'Up', '↓': 'Down', '←': 'Left', '→': 'Right', '\\': 'Backslash', '/': 'Slash', '?': 'Question mark',
}

export type KbdProps = {
  /** Outline on surfaces, Soft in tinted rows and footers, Inverse on dark tooltips. Default `outline`. */
  variant?: 'outline' | 'soft' | 'inverse'
  /** Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** For shortcut sheets that echo the keys being held. */
  pressed?: boolean
  disabled?: boolean
  /** Spoken name. Symbols like ⌘ have one already. */
  spoken?: string
  animated?: boolean
  children: string
  style?: StyleProp<ViewStyle>
}

/** A keycap. One key per cap. */
export function Kbd({ variant = 'outline', size = 'md', pressed = false, disabled = false, spoken, animated = true, children, style }: KbdProps) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const still = reduce || !animated
  const sink = useSharedValue(pressed ? 1 : 0)
  useEffect(() => {
    sink.value = withTiming(pressed ? 1 : 0, { duration: still ? 0 : pressed ? PRESS_MS : RELEASE_MS, easing: pressed ? OUT : SOFT })
  }, [pressed, still, sink])
  const moves = !still
  const cap = useAnimatedStyle(() => ({ transform: [{ translateY: moves ? sink.value : 0 }] }))
  return (
    <Animated.View
      accessible
      accessibilityLabel={spoken ?? SPOKEN[children] ?? children}
      style={[styles.kbd, styles[`size_${size}` as const], styles[variant], pressed ? styles.pressed : null, disabled ? styles.disabled : null, cap, style]}
    >
      {variant === 'inverse' ? <View style={styles.inverseFill} /> : null}
      <Text style={[styles.text, styles[`text_${size}` as const], variant === 'inverse' ? styles.textInverse : null]}>{children}</Text>
    </Animated.View>
  )
}

export type KbdGroupProps = {
  /** Combo adds a plus, chord sets caps close, sequence joins them with then. Default `combo`. */
  kind?: 'combo' | 'chord' | 'sequence'
  /** Caps as text. Or pass `Kbd` children for full control. */
  keys?: string[]
  variant?: KbdProps['variant']
  size?: KbdProps['size']
  animated?: boolean
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/** Caps that belong together. */
export function KbdGroup({ kind = 'combo', keys, variant, size, animated = true, children, style }: KbdGroupProps) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const caps: ReactNode[] = keys
    ? keys.map((cap, i) => <Kbd key={i} {...(variant ? { variant } : {})} {...(size ? { size } : {})} animated={animated}>{cap}</Kbd>)
    : Children.toArray(children)
  return (
    <View style={[styles.group, styles[`group_${kind}` as const], style]}>
      {caps.map((cap, i) => (
        <Fragment key={i}>
          {i > 0 && kind === 'combo' ? <Text style={styles.join} aria-hidden>+</Text> : null}
          {i > 0 && kind === 'sequence' ? <Text style={styles.join}>then</Text> : null}
          {cap}
        </Fragment>
      ))}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  kbd: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  size_sm: { minWidth: 18, height: 18, paddingHorizontal: space[1], borderRadius: radius.md },
  size_md: { minWidth: 22, height: 22, paddingHorizontal: space[1.5], borderRadius: radius.lg },
  size_lg: { minWidth: 28, height: 28, paddingHorizontal: space[2], borderRadius: radius.lg },
  outline: { borderWidth: 1, borderBottomWidth: 2, borderColor: c.ink10, backgroundColor: c.surface },
  soft: { backgroundColor: c.ink5 },
  inverse: {},
  inverseFill: { ...StyleSheet.absoluteFill, backgroundColor: c.textInverse, opacity: 0.16 },
  pressed: { backgroundColor: c.ink8 },
  disabled: { opacity: 0.4 },
  text: { fontFamily: font.sans, fontWeight: '500', color: c.textSecondary },
  textInverse: { color: c.textInverse },
  text_sm: { fontSize: 11, lineHeight: 14, letterSpacing: font.tracking(11) },
  text_md: { fontSize: 12, lineHeight: 16, letterSpacing: font.tracking(12) },
  text_lg: { fontSize: 14, lineHeight: 18, letterSpacing: font.tracking(14) },
  group: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  group_combo: { gap: space[1] },
  group_chord: { gap: space[0.5] },
  group_sequence: { gap: space[1.5] },
  join: { fontFamily: font.sans, fontSize: 12, lineHeight: 16, letterSpacing: font.tracking(12), color: c.textTertiary },
})
