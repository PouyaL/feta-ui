import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { ToneGlyph, toneColors, type BadgeTone } from './badge'
import { Button } from './button'
import { type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

export type AlertTone = BadgeTone

const ENTER_MS = 220
const EXIT_MS = 120
const BANNER_MS = 260
const BADGE_DELAY_MS = 60
const FLY_OUT_MS = 200
const TIMER_MS = 6000
const SWIPE_SHARE = 0.3
const OFFSCREEN_RISE = 80
const OUT_SOFT = Easing.bezier(0.22, 1, 0.36, 1)
const SHEEN = Easing.bezier(0.65, 0, 0.3, 1)
const BADGE_SPRING = { stiffness: 500, damping: 26 } as const
const SLIDE_SPRING = { stiffness: 420, damping: 34 } as const
const BADGE_SIZE = { sm: 20, md: 24, lg: 32 } as const

/** Runs `onEnd` after `ms` of unpaused time. Pausing keeps what is left. */
export function useCountdown(ms: number | null, paused: boolean, onEnd: () => void): void {
  const end = useRef(onEnd)
  end.current = onEnd
  const left = useRef(ms)
  useEffect(() => { left.current = ms }, [ms])
  useEffect(() => {
    if (left.current === null || paused) return undefined
    const started = Date.now()
    const timer = setTimeout(() => end.current(), left.current)
    return () => {
      clearTimeout(timer)
      if (left.current !== null) left.current -= Date.now() - started
    }
  }, [ms, paused])
}

export type AlertBadgeProps = { tone?: AlertTone; size?: 'sm' | 'md' | 'lg'; animated?: boolean; style?: StyleProp<ViewStyle> }

/** A solid circle with a glyph, 20, 24 or 32 points. */
export function AlertBadge({ tone = 'neutral', size = 'md', animated = true, style }: AlertBadgeProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const scale = useSharedValue(still ? 1 : 0.6)
  useEffect(() => {
    if (!still) scale.value = withDelay(BADGE_DELAY_MS, withSpring(1, BADGE_SPRING))
  }, [still, scale])
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const solid = toneColors(colors, tone)
  const circle = useMemo(() => ({ backgroundColor: solid.fill }), [solid.fill])
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.badge, styles[size], circle, pop, style]}>
      <ToneGlyph tone={tone} size={BADGE_SIZE[size] * 0.6} color={solid.ink} />
    </Animated.View>
  )
}

export type AlertAction = { label: string; onPress?: () => void; loading?: boolean; disabled?: boolean }

export type AlertProps = {
  /** Card is the default, Inline sits in content, Banner runs across the page. */
  variant?: 'card' | 'inline' | 'banner'
  /** Default `neutral`. */
  tone?: AlertTone
  title: ReactNode
  description?: ReactNode
  /** One action. Ignored on Inline. */
  action?: AlertAction
  /** Shows the dismiss button. */
  dismissible?: boolean
  onDismiss?: () => void
  /** Auto dismiss after 6 s, or this many ms. Never applies to Danger or Warning. */
  timer?: boolean | number
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A callout that asks for attention without taking over the page. Touching it pauses the timer. */
export function Alert({ variant = 'card', tone = 'neutral', title, description, action, dismissible = false, onDismiss, timer = false, animated = true, style }: AlertProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [open, setOpen] = useState(true)
  const [paused, setPaused] = useState(false)
  const urgent = tone === 'danger' || tone === 'warning'
  const ms = timer && !urgent ? (typeof timer === 'number' ? timer : TIMER_MS) : null
  const banner = variant === 'banner'
  const card = variant === 'card'

  const shown = useSharedValue(animated ? 0 : 1)
  const closing = useSharedValue(1)
  const x = useSharedValue(0)
  const wide = useSharedValue(360)
  const drain = useSharedValue(1)

  useEffect(() => {
    if (animated) shown.value = withTiming(1, { duration: still ? 120 : banner ? BANNER_MS : ENTER_MS, easing: OUT_SOFT })
  }, [animated, still, banner, shown])

  useEffect(() => {
    if (ms === null || !animated) return undefined
    if (paused) {
      cancelAnimation(drain)
      return undefined
    }
    drain.value = withTiming(0, { duration: ms * drain.value, easing: Easing.linear })
    return () => cancelAnimation(drain)
  }, [ms, paused, animated, drain])

  function remove(): void {
    setOpen(false)
    onDismiss?.()
  }

  function dismiss(): void {
    if (still) {
      remove()
      return
    }
    closing.value = withTiming(0, { duration: EXIT_MS, easing: SHEEN }, (done) => { if (done) runOnJS(remove)() })
  }

  useCountdown(open ? ms : null, paused, dismiss)

  const pan = Gesture.Pan()
    .enabled(card)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => { x.value = e.translationX })
    .onEnd((e) => {
      if (Math.abs(e.translationX) < wide.value * SWIPE_SHARE) {
        x.value = withSpring(0, SLIDE_SPRING)
      } else if (still) {
        runOnJS(remove)()
      } else {
        x.value = withTiming(Math.sign(e.translationX) * wide.value * 1.2, { duration: FLY_OUT_MS }, (done) => { if (done) runOnJS(remove)() })
      }
    })

  const moves = !still
  const motion = useAnimatedStyle(() => {
    const swipe = 1 - Math.min(Math.abs(x.value) / (wide.value * 0.7), 1)
    const rise = banner ? -OFFSCREEN_RISE * (1 - shown.value) : -8 * (1 - shown.value)
    return {
      opacity: (banner ? 1 : shown.value) * closing.value * swipe,
      transform: [
        { translateX: x.value },
        { translateY: moves ? rise : 0 },
        { scale: moves && !banner ? 0.98 + 0.02 * Math.min(shown.value, closing.value) : 1 },
      ],
    }
  })
  const timerBar = useAnimatedStyle(() => ({ transform: [{ scaleX: drain.value }] }))

  if (!open) return null
  const titleNode = typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : title
  const dismissButton = <IconButton variant="ghost" size="sm" icon={<ToneGlyph tone="danger" size={16} color={colors.textSecondary} />} label="Dismiss" onPress={dismiss} animated={animated} />
  const descriptionNode = typeof description === 'string' ? <Text style={styles.description}>{description}</Text> : description

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible={!action && !dismissible}
        accessibilityRole="alert"
        accessibilityLiveRegion={urgent ? 'assertive' : 'polite'}
        onLayout={(e) => { wide.value = e.nativeEvent.layout.width }}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
        onTouchCancel={() => setPaused(false)}
        style={[styles.alert, styles[variant], motion, style]}
      >
        {ms === null ? null : <Animated.View style={[styles.timer, styles[`tint_${tone}` as const], timerBar]} />}
        {card ? <AlertBadge tone={tone} animated={animated} /> : null}
        {variant === 'inline' ? <View style={styles.icon}><ToneGlyph tone={tone} size={16} color={colors.textPrimary} /></View> : null}
        <View style={styles.text}>
          {banner ? (
            <Text style={styles.line}>
              <Text style={styles.lineTitle}>{title}</Text>
              {description ? <Text> · {description}</Text> : null}
            </Text>
          ) : (
            <>
              {titleNode}
              {description ? descriptionNode : null}
            </>
          )}
        </View>
        {/* On a phone the card's action drops to its own row under the text, lined up with it (web mobile layout). */}
        {dismissible && card ? <View style={styles.cardDismiss}>{dismissButton}</View> : null}
        {action && variant !== 'inline' ? (
          <View style={card ? styles.cardAction : undefined}>
            <Button variant="secondary" size="sm" status={action.loading ? 'loading' : 'idle'} disabled={action.disabled ?? false} animated={animated} {...(action.onPress ? { onPress: action.onPress } : {})}>{action.label}</Button>
          </View>
        ) : null}
        {dismissible && !card ? dismissButton : null}
      </Animated.View>
    </GestureDetector>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  alert: { flexDirection: 'row', alignItems: 'flex-start', width: '100%', overflow: 'hidden' },
  card: { flexWrap: 'wrap', gap: space[3], paddingVertical: space[4], paddingLeft: space[4], paddingRight: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  inline: { gap: space[2.5], paddingVertical: space[3], paddingHorizontal: space[3.5], borderRadius: radius.control, backgroundColor: c.ink4 },
  banner: { alignItems: 'center', gap: space[3], padding: space[3], paddingHorizontal: space[4], borderBottomWidth: 1, borderBottomColor: c.ink8, backgroundColor: c.ink4 },
  badge: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  sm: { width: BADGE_SIZE.sm, height: BADGE_SIZE.sm },
  md: { width: BADGE_SIZE.md, height: BADGE_SIZE.md },
  lg: { width: BADGE_SIZE.lg, height: BADGE_SIZE.lg },
  icon: { marginTop: space[0.5] },
  cardDismiss: { marginRight: -space[1], marginTop: -space[2] },
  cardAction: { alignItems: 'flex-start', paddingLeft: space[10], width: '100%' },
  text: { flex: 1, minWidth: 0, gap: space[0.5] },
  title: type(14, c.textPrimary, '500'),
  description: { ...type(13, c.textSecondary), lineHeight: 20 },
  line: { ...type(13, c.textSecondary), lineHeight: 20 },
  lineTitle: { fontWeight: '500', color: c.textPrimary },
  tint_neutral: { backgroundColor: toneColors(c, 'neutral').fill },
  tint_info: { backgroundColor: toneColors(c, 'info').fill },
  tint_success: { backgroundColor: toneColors(c, 'success').fill },
  tint_warning: { backgroundColor: toneColors(c, 'warning').fill },
  tint_danger: { backgroundColor: toneColors(c, 'danger').fill },
  tint_accent: { backgroundColor: toneColors(c, 'accent').fill },
  timer: { position: 'absolute', top: 0, left: 0, right: 0, height: 2, transformOrigin: 'left' },
})
