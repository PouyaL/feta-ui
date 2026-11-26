import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import { press, radius, softElevation, space, type Colors } from '../kit'
import { Badge } from './badge'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { Spinner } from './spinner'

const OPEN_MS = 260
const EDITORIAL_OPEN_MS = 300
const CLOSE_MS = 180
const CLOSE_DELAY_MS = 40
const CONTENT_IN_MS = 200
const CONTENT_OUT_MS = 120
const CONTENT_DELAY_MS = 60
const CHEVRON_MS = 200
const CARD_IN_MS = 200
const NUDGE_STEP_MS = 80
const PULSE_MS = 1200
const OUT_SOFT = Easing.bezier(0.22, 1, 0.36, 1)
const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1)
const STANDARD = Easing.bezier(0.2, 0, 0, 1)

export type AccordionItem = {
  value: string
  /** One line. It truncates, so move long questions to a page. */
  title: string
  /** The panel. Shown as a skeleton while `loading`. */
  children?: ReactNode
  disabled?: boolean
  /** Loader in place of the chevron, skeleton in the panel. */
  loading?: boolean
  /** Pro badge and lock. Stays pressable and calls `onLocked` instead of opening. */
  locked?: boolean
}

export type AccordionProps = {
  items: AccordionItem[]
  /** `classic` for settings and FAQs, `soft` for product surfaces, `editorial` for short lists. Default `classic`. */
  styleKind?: 'classic' | 'soft' | 'editorial'
  /** `single` closes the other item, `multiple` keeps them open. Default `single`. */
  type?: 'single' | 'multiple'
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  /** Soft: the name of the group and its meta, in the tray. */
  header?: { title: ReactNode; meta?: ReactNode }
  /** A locked item was activated: open your upsell. */
  onLocked?: (value: string) => void
  renderIcon: RenderIcon
  /** `false` keeps panels and cards still. The loader stays: it shows status. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type RowProps = { item: AccordionItem; styleKind: NonNullable<AccordionProps['styleKind']>; open: boolean; first: boolean; still: boolean; animated: boolean; renderIcon: RenderIcon; onToggle: () => void; onLocked: () => void }

function SkeletonLines() {
  const styles = useThemed(makeStyles)
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.5, { duration: PULSE_MS, easing: IN_OUT }), -1, true)
    return () => cancelAnimation(opacity)
  }, [opacity])
  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.skeleton, fade]}>
      <View style={styles.bar} />
      <View style={[styles.bar, styles.bar2]} />
      <View style={[styles.bar, styles.bar3]} />
    </Animated.View>
  )
}

function Row({ item, styleKind, open, first, still, animated, renderIcon, onToggle, onLocked }: RowProps) {
  const styles = useThemed(makeStyles)
  const { title, children, disabled = false, loading = false, locked = false } = item
  const editorial = styleKind === 'editorial'
  const soft = styleKind === 'soft'
  const [measured, setMeasured] = useState(0)
  const reveal = useSharedValue(open ? 1 : 0)
  const content = useSharedValue(open ? 1 : 0)
  const turn = useSharedValue(open ? 0 : 180)
  const card = useSharedValue(open ? 1 : 0)
  const nudge = useSharedValue(0)
  const scale = useSharedValue(1)

  useEffect(() => {
    const to = open ? 1 : 0
    if (still) {
      reveal.value = to
      turn.value = open ? 0 : 180
      card.value = to
      content.value = withTiming(to, { duration: animated ? CONTENT_OUT_MS : 0, easing: Easing.linear })
      return
    }
    reveal.value = open
      ? withTiming(1, { duration: editorial ? EDITORIAL_OPEN_MS : OPEN_MS, easing: OUT_SOFT })
      : withDelay(CLOSE_DELAY_MS, withTiming(0, { duration: CLOSE_MS, easing: IN_OUT }))
    content.value = open
      ? withDelay(CONTENT_DELAY_MS, withTiming(1, { duration: CONTENT_IN_MS, easing: OUT_SOFT }))
      : withTiming(0, { duration: CONTENT_OUT_MS, easing: STANDARD })
    turn.value = withTiming(open ? 0 : 180, { duration: CHEVRON_MS, easing: IN_OUT })
    card.value = withTiming(to, { duration: open ? CARD_IN_MS : CLOSE_MS, easing: open ? OUT_SOFT : IN_OUT })
  }, [open, still, animated, editorial, reveal, content, turn, card])

  function activate(): void {
    if (disabled) return
    if (locked) {
      if (!still) nudge.value = withSequence(withTiming(3, { duration: NUDGE_STEP_MS, easing: IN_OUT }), withTiming(-3, { duration: NUDGE_STEP_MS, easing: IN_OUT }), withTiming(0, { duration: NUDGE_STEP_MS, easing: IN_OUT }))
      onLocked()
      return
    }
    onToggle()
  }

  const moves = !still
  const panel = useAnimatedStyle(() => ({ height: measured * reveal.value }))
  const inner = useAnimatedStyle(() => ({ opacity: content.value, transform: [{ translateY: moves ? (content.value - 1) * 4 : 0 }] }))
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: nudge.value }] }))
  const cardFade = useAnimatedStyle(() => ({ opacity: card.value }))
  const pressMotion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const titleTone = disabled ? styles.titleDisabled : locked ? styles.titleLocked : editorial ? (open ? styles.titleEditorialOpen : styles.titleEditorial) : null

  return (
    <View style={first || styleKind !== 'classic' ? null : styles.rule}>
      {soft ? <Animated.View pointerEvents="none" style={[styles.card, cardFade]} /> : null}
      <Animated.View style={pressMotion}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={locked ? `${title}, Pro` : title}
        aria-expanded={open}
        aria-disabled={disabled}
        aria-busy={loading}
        disabled={disabled}
        onPress={activate}
        onPressIn={() => { if (moves && !disabled) scale.value = withSpring(press.scale, press.spring) }}
        onPressOut={() => { if (moves) scale.value = withSpring(1, press.spring) }}
        style={({ pressed }) => [styles.trigger, editorial ? styles.triggerEditorial : null, pressed && !disabled && !editorial ? styles.triggerPressed : null]}
      >
        <Text style={[styles.title, editorial ? styles.titleEditorialBase : null, titleTone]} numberOfLines={editorial ? undefined : 1}>{title}</Text>
        {locked ? <Badge size="sm" mark={false} animated={animated}>Pro</Badge> : null}
        {editorial ? null : (
          <Animated.View style={[styles.indicator, disabled ? styles.indicatorDisabled : null, indicator]}>
            {loading ? <Spinner size={20} label={null} />
              : locked ? renderIcon('lock', 20)
              : <Animated.View style={chevron}>{renderIcon('chevron-up', 20)}</Animated.View>}
          </Animated.View>
        )}
      </Pressable>
      </Animated.View>
      <Animated.View accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} pointerEvents={open ? 'auto' : 'none'} style={[styles.panel, panel]}>
        <Animated.View onLayout={(e) => setMeasured(e.nativeEvent.layout.height)} style={[styles.measure, editorial ? styles.contentEditorial : styles.content, inner]}>
          {loading ? <SkeletonLines /> : typeof children === 'string' ? <Text style={styles.body}>{children}</Text> : children}
        </Animated.View>
      </Animated.View>
    </View>
  )
}

/** Headings that each reveal a panel. One family in three looks. */
export function Accordion({ items, styleKind = 'classic', type: mode = 'single', value, defaultValue = [], onValueChange, header, onLocked, renderIcon, animated = true, style }: AccordionProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const current = value ?? held
  const open = useMemo(() => new Set(current), [current])

  function toggle(item: string): void {
    const next = open.has(item) ? current.filter((entry) => entry !== item) : mode === 'single' ? [item] : [...current, item]
    setHeld(next)
    onValueChange?.(next)
  }

  return (
    <View style={[styles.accordion, styleKind === 'soft' ? styles.soft : null, style]}>
      {header ? (
        <View style={styles.header}>
          {typeof header.title === 'string' ? <Text style={styles.headerTitle}>{header.title}</Text> : header.title}
          {typeof header.meta === 'string' ? <Text style={styles.meta}>{header.meta}</Text> : header.meta}
        </View>
      ) : null}
      {items.map((item, i) => (
        <Row
          key={item.value}
          item={item}
          styleKind={styleKind}
          open={!item.locked && open.has(item.value)}
          first={i === 0}
          still={still}
          animated={animated}
          renderIcon={renderIcon}
          onToggle={() => toggle(item.value)}
          onLocked={() => onLocked?.(item.value)}
        />
      ))}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  accordion: { width: '100%', minWidth: 0 },
  soft: { gap: space[0.5], padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], height: 40, paddingHorizontal: space[4] },
  headerTitle: { ...type(13, c.textPrimary, '500'), lineHeight: 16 },
  meta: type(12, c.textTertiary, '400', true),
  rule: { borderTopWidth: 1, borderTopColor: c.ink8 },
  card: { ...StyleSheet.absoluteFill, borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface, boxShadow: softElevation(c) },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: space[3], width: '100%', minHeight: 56, paddingVertical: space[1], paddingHorizontal: space[4], borderRadius: radius.control },
  triggerEditorial: { minHeight: 44, paddingHorizontal: 0, borderRadius: radius.md },
  triggerPressed: { backgroundColor: c.ink8 },
  title: { ...type(16, c.textPrimary, '500'), flex: 1, minWidth: 0, lineHeight: 22 },
  titleEditorialBase: { ...type(18, c.textTertiary), lineHeight: 26 },
  titleEditorial: { color: c.textTertiary },
  titleEditorialOpen: { color: c.textPrimary },
  titleDisabled: { color: c.textQuaternary },
  titleLocked: { color: c.textTertiary },
  indicator: { alignItems: 'center', justifyContent: 'center', width: 20, height: 20 },
  indicatorDisabled: { opacity: 0.3 },
  panel: { overflow: 'hidden' },
  measure: { position: 'absolute', top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: space[4], paddingBottom: 18 },
  contentEditorial: { paddingBottom: space[2] },
  body: { ...type(15, c.textSecondary), lineHeight: 22 },
  skeleton: { gap: space[2], paddingVertical: space[1] },
  bar: { height: 10, borderRadius: radius.full, backgroundColor: c.ink5 },
  bar2: { width: '88%' },
  bar3: { width: '56%' },
})
