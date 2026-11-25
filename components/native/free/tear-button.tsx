import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Line } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { ICON_SIZE, withInk, type Spring } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

const TEAR_AT = 44
const REACH = 72
const SWING = 14
const ELASTIC = 0.1
const FLICK = 600
const RESET_MS = 2400
const FALL_MS = 500
const FADE_MS = 120
const FALL_Y = 120
const FALL_TURN = 38
const FALL_EASE = Easing.bezier(0.42, 0, 1, 1)
const TEAR: Spring = { stiffness: 900, damping: 42, mass: 1 }
const HEIGHT = 64
const BADGE_ICON = 14
const ACTIONS = [{ name: 'activate' }]

export type TearButtonProps = {
  title?: string
  meta?: string
  tornTitle?: string
  tornMeta?: string
  tone?: 'default' | 'muted' | 'danger'
  icon?: ReactNode
  /** Draws `arrow-right`, `tick-02`, and `ticket` when `icon` is left out. */
  renderIcon: RenderIcon
  onTear?: () => void
  disabled?: boolean
  /** `false` fades the stub instead of swinging it. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A ticket you confirm by tearing off its stub. A screen reader's activate tears it too. */
export function TearButton({ title = 'Redeem ticket', meta = 'Tear the stub to confirm', tornTitle = 'Ticket redeemed', tornMeta = 'New stub in a moment', tone = 'default', icon, renderIcon, onTear, disabled, animated = true, style }: TearButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const off = Boolean(disabled)
  const [torn, setTorn] = useState(false)
  const x = useSharedValue(0)
  const start = useSharedValue(0)
  const fall = useSharedValue(0)

  useEffect(() => {
    if (!torn) return undefined
    const timer = setTimeout(() => { x.value = 0; fall.value = 0; setTorn(false) }, RESET_MS)
    return () => clearTimeout(timer)
  }, [torn, x, fall])

  function tear(): void {
    setTorn(true)
    onTear?.()
    fall.value = withTiming(1, still ? { duration: FADE_MS } : { duration: FALL_MS, easing: FALL_EASE })
  }
  // The pan gesture calls tear through this stable JS thread wrapper, which reads the latest tear
  // (onTear, still), so the gesture keeps its narrow rebuild set.
  const tearRef = useRef(tear)
  useEffect(() => {
    tearRef.current = tear
  })
  const tearLatest = useCallback((): void => tearRef.current(), [])

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!off && !torn)
    .activeOffsetX([-6, 6])
    .failOffsetY([-16, 16])
    .onStart(() => { start.value = x.value })
    .onUpdate((event) => {
      const next = start.value + event.translationX
      x.value = next < 0 ? next * ELASTIC : next > REACH ? REACH + (next - REACH) * ELASTIC : next
    })
    .onEnd((event) => {
      if (x.value > TEAR_AT || event.velocityX > FLICK) runOnJS(tearLatest)()
      else x.value = withSpring(0, TEAR)
    }), [off, torn, start, x, tearLatest])

  function handleAction({ nativeEvent }: AccessibilityActionEvent): void {
    if (nativeEvent.actionName === 'activate' && !off && !torn) tear()
  }

  const stubStyle = useAnimatedStyle(() => {
    const swing = interpolate(x.value, [0, REACH], [0, SWING])
    return {
      opacity: 1 - fall.value,
      transform: still
        ? [{ translateX: x.value }, { rotate: `${swing}deg` }]
        : [{ translateX: x.value }, { translateY: FALL_Y * fall.value }, { rotate: `${swing + (FALL_TURN - swing) * fall.value}deg` }],
    }
  })

  const badgeIcon = torn ? renderIcon('tick-02', BADGE_ICON) : icon ?? renderIcon('ticket', BADGE_ICON)
  const badgeInk = tone === 'muted' && !torn ? colors.textSecondary : colors.textInverse

  return (
    <View style={[styles.ticket, off && styles.off, style]}>
      <View style={[styles.body, torn && styles.bodyTorn]}>
        <View style={[styles.badge, tone === 'muted' && styles.badgeMuted, tone === 'danger' && styles.badgeDanger, torn && styles.badgeTorn]}>{withInk(badgeIcon, badgeInk)}</View>
        <View accessibilityLiveRegion="polite" style={styles.text}>
          <Text numberOfLines={1} style={styles.title}>{torn ? tornTitle : title}</Text>
          <Text numberOfLines={1} style={styles.meta}>{torn ? tornMeta : meta}</Text>
        </View>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View
          accessible={!torn}
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityHint="Drag right to tear"
          aria-disabled={off}
          accessibilityActions={ACTIONS}
          onAccessibilityAction={handleAction}
          pointerEvents={torn ? 'none' : 'auto'}
          style={[styles.stub, torn && styles.stubFallen, stubStyle]}
        >
          <Svg aria-hidden style={styles.perforation} width={2} height={HEIGHT}>
            <Line x1={1} y1={0} x2={1} y2={HEIGHT} stroke={colors.ink10} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" />
          </Svg>
          {withInk(renderIcon('arrow-right', ICON_SIZE), colors.textPrimary)}
          <Text style={styles.stubText}>Tear</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  ticket: { flexDirection: 'row', height: HEIGHT, maxWidth: 304, width: '100%' },
  off: { opacity: 0.4 },
  body: { alignItems: 'center', backgroundColor: c.surface, borderBottomLeftRadius: radius.card, borderColor: c.ink8, borderTopLeftRadius: radius.card, borderWidth: 1, flex: 1, flexDirection: 'row', gap: space[3], minWidth: 0, paddingHorizontal: space[3.5] },
  bodyTorn: { borderRadius: radius.card },
  badge: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.full, height: space[7], justifyContent: 'center', width: space[7] },
  badgeMuted: { backgroundColor: c.ink5 },
  badgeDanger: { backgroundColor: c.danger },
  badgeTorn: { backgroundColor: c.success },
  text: { flex: 1, gap: space[0.5], minWidth: 0 },
  title: type(14, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
  stub: { alignItems: 'center', backgroundColor: c.muted, borderBottomRightRadius: radius.card, borderColor: c.ink8, borderTopRightRadius: radius.card, borderWidth: 1, gap: space[0.5], height: HEIGHT, justifyContent: 'center', transformOrigin: 'left center', width: 72 },
  stubFallen: { position: 'absolute', right: 0 },
  perforation: { left: 0, position: 'absolute', top: 0 },
  stubText: type(12, c.textPrimary, '500'),
})
