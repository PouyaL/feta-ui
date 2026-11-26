import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg'
import { font, openLink, radius, space, useColors, useReduceMotion, type Colors } from '../kit'
import { withInk } from './button'
import { Spinner } from './spinner'

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent'
type GlyphName = 'info' | 'check' | 'exclamation' | 'x' | 'sparkles'

const TONE_GLYPH: Record<BadgeTone, GlyphName> = { neutral: 'info', info: 'info', success: 'check', warning: 'exclamation', danger: 'x', accent: 'sparkles' }
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const ENTER_MS = 150
const REDUCED_MS = 120
const COUNT_FADE_MS = 150
const POP = { stiffness: 420, damping: 26 } as const
const DIGIT = { stiffness: 520, damping: 30 } as const
const STATE_SPRING = { stiffness: 260, damping: 20 } as const
const ROLL_OFFSET = 8

/** A tone's solid fill and the ink on it. Tone is never shown by colour alone: each has its own glyph. */
export function toneColors(c: Colors, tone: BadgeTone): { fill: string; ink: string } {
  // Every tone has its status colour, as on the web (--feta-status-*); only neutral is the inverse ink.
  if (tone === 'success') return { fill: c.success, ink: c.onSolid }
  if (tone === 'danger') return { fill: c.danger, ink: c.onSolid }
  if (tone === 'warning') return { fill: c.warning, ink: c.onSolid }
  if (tone === 'info') return { fill: c.info, ink: c.onSolid }
  if (tone === 'accent') return { fill: c.accent, ink: c.onSolid }
  return { fill: c.inverse, ink: c.textInverse }
}

/** Plain strokes for the tone marks, sized to sit in a small circle. */
export function ToneGlyph({ tone, size, color }: { tone: BadgeTone; size: number; color: string }) {
  const name = TONE_GLYPH[tone]
  const line = { stroke: color, strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <Svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'check' ? <Polyline points="5 13 10 18 19 7" {...line} /> : null}
      {name === 'x' ? <><Line x1={6} y1={6} x2={18} y2={18} {...line} /><Line x1={18} y1={6} x2={6} y2={18} {...line} /></> : null}
      {name === 'info' ? <><Line x1={12} y1={11} x2={12} y2={18} {...line} /><Circle cx={12} cy={6} r={1.5} fill={color} /></> : null}
      {name === 'exclamation' ? <><Line x1={12} y1={5} x2={12} y2={13} {...line} /><Circle cx={12} cy={18.5} r={1.5} fill={color} /></> : null}
      {name === 'sparkles' ? <Path d="M12 3 L14 10 L21 12 L14 14 L12 21 L10 14 L3 12 L10 10 Z" fill={color} /> : null}
    </Svg>
  )
}

/** Digits that slide up into place when the value changes. */
export function RollingText({ value, still, style }: { value: string; still: boolean; style?: StyleProp<TextStyle> }) {
  const offset = useSharedValue(0)
  const previous = useRef(value)
  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    if (still) return
    offset.value = ROLL_OFFSET
    offset.value = withSpring(0, DIGIT)
  }, [value, still, offset])
  const roll = useAnimatedStyle(() => ({ opacity: 1 - offset.value / ROLL_OFFSET, transform: [{ translateY: offset.value }] }))
  return <Animated.Text style={[style, roll]}>{value}</Animated.Text>
}

export type BadgeProps = {
  /** Sets the mark colour. The pill stays ink. Default `neutral`. */
  tone?: BadgeTone
  /** Default `soft`. */
  variant?: 'soft' | 'outline' | 'inverse' | 'ghost'
  /** Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** `false` hides the mark for a plain category. */
  mark?: boolean
  /** Replaces the tone glyph inside the mark. */
  icon?: ReactNode
  /** Makes the badge a link, with the trailing arrow. */
  href?: string
  /** `false` turns off the fade in. */
  animated?: boolean
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

const SIZE = {
  sm: { height: 24, mark: 16, glyph: 10, right: 8, text: 12 },
  md: { height: 28, mark: 20, glyph: 12, right: 10, text: 13 },
  lg: { height: 32, mark: 22, glyph: 14, right: 12, text: 14 },
} as const

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** A short label that names a status or a category. Links when given `href`. */
/** Plain text children as one string: `+{n}` or `{n} failing` arrive as arrays or numbers, not one string. */
function plainText(node: ReactNode): string | null {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node) && node.every((part) => typeof part === 'string' || typeof part === 'number')) return node.join('')
  return null
}

export function Badge({ tone = 'neutral', variant = 'soft', size = 'md', mark = true, icon, href, animated = true, children, style }: BadgeProps) {
  const text = plainText(children)
  const colors = useColors()
  const reduce = useReduceMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const entered = useSharedValue(animated ? 0 : 1)
  const moves = !reduce
  useEffect(() => {
    if (animated) entered.value = withTiming(1, { duration: reduce ? REDUCED_MS : ENTER_MS, easing: OUT })
  }, [animated, reduce, entered])
  const enter = useAnimatedStyle(() => ({ opacity: entered.value, transform: [{ scale: moves ? 0.9 + entered.value * 0.1 : 1 }] }))
  const inverse = variant === 'inverse'
  const solid = inverse && tone === 'neutral' ? { fill: colors.textInverse, ink: colors.inverse } : toneColors(colors, tone)
  const ink = inverse ? colors.textInverse : colors.textSecondary
  const metrics = SIZE[size]
  const shape = useMemo<ViewStyle>(() => ({ height: metrics.height, paddingRight: metrics.right, paddingLeft: mark ? (metrics.height - metrics.mark) / 2 : metrics.right }), [metrics, mark])
  const dot = useMemo<ViewStyle>(() => ({ width: metrics.mark, height: metrics.mark, backgroundColor: solid.fill }), [metrics, solid.fill])
  const label = useMemo(() => ({ fontSize: metrics.text, letterSpacing: font.tracking(metrics.text), color: ink }), [metrics, ink])
  const body = (
    <>
      {mark ? <View style={[styles.mark, dot]}>{icon ? withInk(icon, solid.ink) : <ToneGlyph tone={tone} size={metrics.glyph} color={solid.ink} />}</View> : null}
      {text !== null ? <Text style={[styles.label, label]} numberOfLines={1}>{text}</Text> : children}
      {href ? (
        <Svg aria-hidden width={metrics.glyph} height={metrics.glyph} viewBox="0 0 24 24" fill="none" opacity={0.4}>
          <Polyline points="8 6 18 6 18 16" stroke={ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <Line x1={18} y1={6} x2={6} y2={18} stroke={ink} strokeWidth={2.5} strokeLinecap="round" />
        </Svg>
      ) : null}
    </>
  )
  const look = [styles.badge, styles[variant], shape, enter, style]
  if (!href) return <Animated.View style={look}>{body}</Animated.View>
  return (
    <AnimatedPressable
      accessibilityRole="link"
      accessibilityLabel={text ?? href}
      hitSlop={(44 - metrics.height) / 2}
      onPress={() => { openLink(href) }}
      style={look}
    >
      {body}
    </AnimatedPressable>
  )
}

export type BadgeCountProps = {
  /** Hides at zero. Leave it out for a dot. */
  value?: number
  /** Above this it reads `99+`. */
  max?: number
  /** Default `neutral`. Danger only when it is urgent. */
  tone?: 'neutral' | 'danger'
  /** Default `md`. */
  size?: 'sm' | 'md'
  /** The accessible name, like `3 unread messages`. */
  label: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Marks what is new. Digits roll in place, and it pops in and out. */
export function BadgeCount({ value, max = 99, tone = 'neutral', size = 'md', label, animated = true, style }: BadgeCountProps) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const still = reduce || !animated
  const dot = value === undefined
  const shown = dot || value > 0
  const text = dot ? '' : value > max ? `${max}+` : String(value)
  const [mounted, setMounted] = useState(shown)
  const scale = useSharedValue(shown ? 1 : 0)
  useEffect(() => {
    if (shown) {
      setMounted(true)
      scale.value = still ? 1 : withSpring(1, POP)
      return undefined
    }
    scale.value = still ? 0 : withTiming(0, { duration: COUNT_FADE_MS })
    const timer = setTimeout(() => setMounted(false), still ? 0 : COUNT_FADE_MS)
    return () => clearTimeout(timer)
  }, [shown, still, scale])
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const danger = tone === 'danger'
  if (!mounted) return null
  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.count, size === 'sm' ? styles.countSm : styles.countMd, dot ? (size === 'sm' ? styles.dotSm : styles.dotMd) : null, danger ? styles.countDanger : null, pop, style]}
    >
      {dot ? null : <RollingText value={text} still={still} style={[styles.countText, size === 'sm' ? styles.countSmText : null]} />}
    </Animated.View>
  )
}

/** Sits a Badge Count on the corner of an Icon Button or Avatar. */
export function BadgeAnchor({ badge, children }: { badge: ReactNode; children: ReactNode }) {
  const colors = useColors()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return <View style={styles.anchor}>{children}<View pointerEvents="none" style={styles.anchored}>{badge}</View></View>
}

export type BadgeStateKind = 'success' | 'loading' | 'error' | 'warning' | 'info' | 'action'

const STATE_TONE: Record<Exclude<BadgeStateKind, 'loading'>, BadgeTone> = { success: 'success', error: 'danger', warning: 'warning', info: 'info', action: 'accent' }
const STATE_NAME: Record<BadgeStateKind, string> = { success: 'Success', loading: 'Loading', error: 'Error', warning: 'Warning', info: 'Info', action: 'Action' }
const STATE_SIZE = { sm: { box: 20, glyph: 12 }, md: { box: 24, glyph: 14 }, lg: { box: 32, glyph: 18 } } as const

export type BadgeStateProps = {
  state: BadgeStateKind
  /** Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** Overrides the spoken state. Pass `null` when text beside it says the same. */
  label?: string | null
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A solid status circle. The glyph swaps on a soft spring. */
export function BadgeState({ state, size = 'md', label, animated = true, style }: BadgeStateProps) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const still = reduce || !animated
  const tone = state === 'loading' ? 'neutral' : STATE_TONE[state]
  const solid = toneColors(colors, tone)
  const metrics = STATE_SIZE[size]
  const swap = useSharedValue(1)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    swap.value = 0
    swap.value = still ? withTiming(1, { duration: animated ? REDUCED_MS : 0 }) : withSpring(1, STATE_SPRING)
  }, [state, still, animated, swap])
  const glyph = useAnimatedStyle(() => ({ opacity: Math.min(swap.value, 1), transform: [{ scale: still ? 1 : 0.6 + swap.value * 0.4 }] }))
  const circle = useMemo<ViewStyle>(() => ({ width: metrics.box, height: metrics.box, backgroundColor: solid.fill }), [metrics, solid.fill])
  const name = label === undefined ? STATE_NAME[state] : label
  return (
    <View
      accessible={name !== null}
      {...(name === null ? {} : { accessibilityRole: 'image' as const, accessibilityLabel: name })}
      style={[styles.state, circle, style]}
    >
      <Animated.View style={glyph}>
        {state === 'loading'
          ? <Spinner label={null} size={metrics.glyph} animated={animated} color={solid.ink} />
          : <ToneGlyph tone={tone} size={metrics.glyph} color={solid.ink} />}
      </Animated.View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space[1.5], borderRadius: radius.full },
  soft: { backgroundColor: c.ink5 },
  outline: { borderWidth: 1, borderColor: c.ink10 },
  inverse: { backgroundColor: c.inverse },
  ghost: { backgroundColor: 'transparent' },
  mark: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  label: { fontFamily: font.sans, fontWeight: '500', lineHeight: 16 },
  count: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, borderWidth: 2, borderColor: c.surface, backgroundColor: c.inverse },
  countMd: { minWidth: 22, height: 22, paddingHorizontal: space[1.5] },
  countSm: { minWidth: 18, height: 18, paddingHorizontal: space[1] },
  dotMd: { minWidth: 10, width: 10, height: 10, paddingHorizontal: 0 },
  dotSm: { minWidth: 8, width: 8, height: 8, paddingHorizontal: 0 },
  countDanger: { backgroundColor: c.danger },
  countText: { fontFamily: font.sans, fontSize: 11, fontWeight: '500', color: c.textInverse },
  countSmText: { fontSize: 10 },
  anchor: { alignSelf: 'flex-start' },
  anchored: { position: 'absolute', top: -space[1.5], right: -space[1.5] },
  state: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
})
