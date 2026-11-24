import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, FadeOutUp, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { openLink, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'

const POP = { stiffness: 420, damping: 26, mass: 1 } as const
const DIGIT = { stiffness: 520, damping: 30, mass: 1 } as const
const SHAKE_LEG_MS = 120
const SWAP_MS = 200
const SWAP_EASE = Easing.bezierFn(0.23, 1, 0.32, 1)

const CIRCLE = 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z'

/** Plain stroke marks for control states, drawn only when the app passes no `renderIcon`. */
const MARKS = {
  'alert-circle': `${CIRCLE}M12 8v5M12 16.5v.01`,
  'arrow-left': 'M19 12H5m6-6-6 6 6 6',
  'arrow-right': 'M5 12h14m-6-6 6 6-6 6',
  'arrow-up': 'M12 19V5m-6 6 6-6 6 6',
  calendar: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM4 10h16M8 3v4M16 3v4',
  'chevron-left': 'M15 6l-6 6 6 6',
  'chevron-right': 'M9 6l6 6-6 6',
  'chevron-up': 'M6 15l6-6 6 6',
  clock: `${CIRCLE}M12 7.5V12l3 2`,
  copy: 'M10 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1ZM6 15H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1',
  'delete-02': 'M9 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-6-6ZM12 10l4 4m0-4-4 4',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM12 9.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5Z',
  'eye-off': 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12ZM4 4l16 16',
  'information-circle': `${CIRCLE}M12 11v5M12 8v.01`,
  minus: 'M5 12h14',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
  'more-horizontal': 'M6 12v.01M12 12v.01M18 12v.01',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13a6.5 6.5 0 1 0 0-13ZM16 16l4 4',
  sparkles: 'M12 4l1.8 6.2L20 12l-6.2 1.8L12 20l-1.8-6.2L4 12l6.2-1.8Z',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8ZM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4',
  'tick-02': 'M5 13l4.5 4.5L19 7',
  undo: 'M8 6 4 10l4 4M4 10h10a5 5 0 0 1 0 10h-3',
  upload: 'M12 16V5m-5 5 5-5 5 5M5 19h14',
  x: 'M6 6l12 12M18 6 6 18',
} as const

export type MarkName = keyof typeof MARKS

export function Mark({ name, size = 16, color }: { name: MarkName; size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={MARKS[name]} stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

/** The app's icon by name, or a plain mark when it passes none. */
export const iconFor = (renderIcon: RenderIcon | undefined, name: MarkName, size: number, color: string): ReactNode =>
  renderIcon ? renderIcon(name, size) : <Mark name={name} size={size} color={color} />

const digitIn = FadeInDown.springify().stiffness(DIGIT.stiffness).damping(DIGIT.damping).mass(DIGIT.mass).withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })
const digitOut = FadeOutUp.duration(SWAP_MS)
const swapIn = FadeInDown.duration(SWAP_MS).easing(SWAP_EASE).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })
const swapOut = FadeOutUp.duration(SWAP_MS).easing(SWAP_EASE)

/** Each character rolls on its own, so only the ones that change move. */
export function RollingText({ value, still, style }: { value: string; still: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <View accessible accessibilityLabel={value} style={rolling.row}>
      {Array.from(value).map((char, i) => (
        <View key={i} style={rolling.digit}>
          <Animated.Text key={char} {...(still ? {} : { entering: digitIn, exiting: digitOut })} style={style}>{char}</Animated.Text>
        </View>
      ))}
    </View>
  )
}

/** One line of text that swaps with a short rise. */
export function LabelSwap({ swapKey, still, style, children }: { swapKey: string; still: boolean; style?: StyleProp<TextStyle>; children: ReactNode }) {
  return <Animated.Text key={swapKey} {...(still ? {} : { entering: swapIn, exiting: swapOut })} style={style}>{children}</Animated.Text>
}

export type LabelProps = {
  children: ReactNode
  /** Danger asterisk. Set `required` on the control too. */
  required?: boolean
  /** A tertiary word after the name: Optional, Locked. */
  optional?: string
  /** A press on the info icon opens this as a tip, and it reads as a hint. */
  hint?: string
  /** A 5% chip for New or Beta. */
  badge?: string
  /** A link on the right, like Forgot? */
  action?: { label: string; href?: string; onPress?: () => void }
  /** A mono count on the right. Turns danger past `max`. */
  count?: { value: number; max: number }
  /** Follows the control: a dot grows in while it has focus. */
  focused?: boolean
  invalid?: boolean
  disabled?: boolean
  /** Change this number to shake the row once, on a failed submit. */
  shake?: number
  /** Draws the info and alert icons by name. */
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** The name of a control. */
export function Label({ children, required, optional, hint, badge, action, count, focused = false, invalid = false, disabled = false, shake = 0, renderIcon, animated = true, style }: LabelProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [tip, setTip] = useState(false)
  const dot = useSharedValue(focused ? 1 : 0)
  const x = useSharedValue(0)
  const over = count ? count.value > count.max : false

  useEffect(() => {
    const target = focused ? 1 : 0
    dot.value = still ? target : withSpring(target, POP)
  }, [focused, still, dot])

  useEffect(() => {
    if (!shake || still) return
    const leg = { duration: SHAKE_LEG_MS, easing: SWAP_EASE }
    x.value = withSequence(withTiming(3, leg), withTiming(-3, leg), withTiming(0, leg))
  }, [shake, still, x])

  const dotStyle = useAnimatedStyle(() => {
    const grown = Math.max(0, dot.value) * 6
    return { marginRight: grown, transform: [{ scale: Math.max(0, dot.value) }], width: grown }
  })
  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))

  function openAction(): void {
    action?.onPress?.()
    if (action?.href) openLink(action.href)
  }

  return (
    <Animated.View style={[styles.row, disabled && styles.disabled, rowStyle, style]}>
      <View style={styles.name}>
        <Animated.View style={[styles.dot, invalid && styles.dotInvalid, dotStyle]} />
        <Text style={[styles.nameText, invalid && styles.dangerText]}>{children}</Text>
        {required ? <Text style={styles.asterisk} accessibilityLabel="required">*</Text> : null}
      </View>
      {optional ? <Text style={styles.optional}>{optional}</Text> : null}
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View> : null}
      {hint ? (
        <View>
          <Pressable accessibilityRole="button" accessibilityLabel="More information" accessibilityHint={hint} aria-expanded={tip} hitSlop={15} onPress={() => setTip(!tip)}>
            {iconFor(renderIcon, 'information-circle', 14, colors.textTertiary)}
          </Pressable>
          {tip ? (
            <Animated.View {...(still ? {} : { entering: FadeIn.duration(SWAP_MS), exiting: FadeOut.duration(SWAP_MS) })} style={styles.tip}>
              <Text style={styles.tipText}>{hint}</Text>
            </Animated.View>
          ) : null}
        </View>
      ) : null}
      {invalid ? iconFor(renderIcon, 'alert-circle', 14, colors.danger) : null}
      {action ? (
        <Pressable accessibilityRole={action.href ? 'link' : 'button'} accessibilityLabel={action.label} hitSlop={12} style={styles.right} onPress={openAction}>
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      ) : null}
      {count ? (
        <View style={[styles.right, styles.count]}>
          <RollingText value={String(count.value)} still={still} style={[styles.countText, over && styles.dangerText]} />
          <Text style={[styles.countText, over && styles.dangerText]}>/{count.max}</Text>
        </View>
      ) : null}
    </Animated.View>
  )
}

const rolling = StyleSheet.create({
  row: { flexDirection: 'row' },
  digit: { overflow: 'hidden' },
})

const createStyles = (c: Colors) => StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 20 },
  disabled: { opacity: 0.5 },
  name: { alignItems: 'center', flexDirection: 'row', flexShrink: 1 },
  nameText: { ...type(15, c.textPrimary, '500'), flexShrink: 1 },
  dot: { backgroundColor: c.textPrimary, borderRadius: radius.full, height: 6 },
  dotInvalid: { backgroundColor: c.danger },
  dangerText: { color: c.danger },
  asterisk: { ...type(15, c.danger, '500'), marginLeft: space[0.5] },
  optional: type(12, c.textTertiary),
  badge: { backgroundColor: c.ink5, borderRadius: radius.md, paddingHorizontal: space[1.5], paddingVertical: space[0.5] },
  badgeText: type(12, c.textSecondary, '500'),
  tip: { backgroundColor: c.inverse, borderRadius: radius.lg, bottom: '100%', left: -space[2], marginBottom: space[1.5], maxWidth: 220, paddingHorizontal: space[2], paddingVertical: space[1], position: 'absolute', zIndex: 20 },
  tipText: type(12, c.textInverse),
  right: { marginLeft: 'auto' },
  action: { ...type(14, c.textSecondary, '500'), textDecorationLine: 'underline' },
  count: { flexDirection: 'row' },
  countText: type(12, c.textTertiary, '400', true),
})
