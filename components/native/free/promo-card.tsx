import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, LayoutAnimationConfig, ZoomIn, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Badge } from './badge'
import { Button, withInk } from './button'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { RollingText } from './label'

const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
/** Offer to claimed crossfade: 240 ms. */
const CLAIM_MS = 240
const viewIn = FadeIn.duration(CLAIM_MS).easing(EASE_OUT)
const viewOut = FadeOut.duration(CLAIM_MS).easing(EASE_OUT)
const markIn = ZoomIn.springify().stiffness(420).damping(26)
const ARROW = { duration: 150, easing: EASE_OUT }
const ARROW_SHIFT = 2

const clock = (seconds: number): string => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((part) => String(part).padStart(2, '0')).join(':')

export type PromoState = 'default' | 'ending' | 'claimed'

export type PromoCardProps = {
  /** The product on the tray. */
  brand: ReactNode
  /** The tag beside the brand. Default `Pro`. */
  tag?: string
  /** Shown on the tray. */
  price?: string
  title?: ReactNode
  description?: ReactNode
  /** The quiet line under the description. */
  meta?: ReactNode
  /** The action on `default`. */
  actionLabel?: string
  state?: PromoState
  defaultState?: PromoState
  onStateChange?: (state: PromoState) => void
  /** Seconds left on `ending`. Keep Ending to the last 24 hours. */
  endsIn?: number
  /** The price after the offer ends. */
  laterPrice?: string
  laterLabel?: string
  endingActionLabel?: string
  claimedTitle?: ReactNode
  claimedDescription?: ReactNode
  claimedMeta?: ReactNode
  claimedActionLabel?: string
  /** The tray label on `claimed`. */
  claimedLabel?: string
  /** The main action. On `ending`, the card moves to `claimed` afterwards unless `state` is controlled. */
  onAction?: () => void
  /** The action on `claimed`. */
  onClaimedAction?: () => void
  /** Fires when the countdown reaches zero. */
  onExpire?: () => void
  renderIcon: RenderIcon
  /** `false` turns off the arrow, the rolling digits and the crossfade. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** `Button` inks its trailing icon with `color`. The web's hover nudge runs on press here. */
function Arrow({ shift, renderIcon, color }: { shift: SharedValue<number>; renderIcon: RenderIcon; color?: string }) {
  const nudge = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value * ARROW_SHIFT }, { translateY: -shift.value * ARROW_SHIFT }] }))
  const icon = renderIcon('arrow-up-right', 16)
  return <Animated.View style={nudge}>{color ? withInk(icon, color) : icon}</Animated.View>
}

/** One offer in a quiet spot: brand on the tray, offer in an inset card and one Primary Pill Button. */
export function PromoCard({
  brand, tag = 'Pro', price, title = 'Limited Offer', description, meta, actionLabel = 'Explore', state, defaultState = 'default', onStateChange,
  endsIn = 0, laterPrice, laterLabel = 'after tonight', endingActionLabel = 'Claim before midnight', claimedTitle, claimedDescription, claimedMeta, claimedActionLabel = 'Open dashboard', claimedLabel = 'Paid',
  onAction, onClaimedAction, onExpire, renderIcon, animated = true, style,
}: PromoCardProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultState)
  const current = state ?? held
  const [left, setLeft] = useState(endsIn)
  const shift = useSharedValue(0)

  useEffect(() => {
    if (current !== 'ending') return undefined
    const end = Date.now() + endsIn * 1000
    setLeft(endsIn)
    const timer = setInterval(() => {
      const next = Math.max(0, Math.round((end - Date.now()) / 1000))
      setLeft(next)
      if (next === 0) { clearInterval(timer); onExpire?.() }
    }, 1000)
    return () => clearInterval(timer)
  }, [current, endsIn, onExpire])

  function act(): void {
    onAction?.()
    if (current !== 'ending') return
    setHeld('claimed')
    onStateChange?.('claimed')
  }

  const lean = (to: number): void => { if (!still) shift.value = withTiming(to, ARROW) }
  const arrow = <Arrow shift={shift} renderIcon={renderIcon} />
  const claimed = current === 'claimed'

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.header}>
        <View style={styles.brand}><Text style={styles.brandName}>{brand}</Text><Badge variant="outline" size="sm" mark={false} animated={animated}>{tag}</Badge></View>
        {current === 'ending'
          ? <View accessible accessibilityRole="timer" accessibilityLabel={`Ends in ${clock(left)}`} style={styles.timer}><Text style={styles.timerText}>Ends in </Text><RollingText value={clock(left)} still={still} style={styles.timerText} /></View>
          : <Text style={styles.price}>{claimed ? claimedLabel : price}</Text>}
      </View>
      <Card variant="plain" animated={animated} bodyStyle={styles.inset}>
        <LayoutAnimationConfig skipEntering>
          {claimed ? (
            <Animated.View key="claimed" {...(still ? {} : { entering: viewIn, exiting: viewOut })} style={styles.view}>
              <View style={styles.claimedTitle}>
                <Animated.View {...(still ? {} : { entering: markIn })} style={styles.mark}>{withInk(renderIcon('check', 14), colors.onSolid)}</Animated.View>
                <Text style={styles.title} accessibilityRole="header">{claimedTitle}</Text>
              </View>
              <Text style={styles.description}>{claimedDescription}</Text>
              <Text style={styles.meta}>{claimedMeta}</Text>
              <Button style={styles.action} variant="secondary" shape="pill" size="lg" trailingIcon={arrow} animated={animated} onPress={onClaimedAction} onPressIn={() => lean(1)} onPressOut={() => lean(0)}>{claimedActionLabel}</Button>
            </Animated.View>
          ) : (
            <Animated.View key="offer" {...(still ? {} : { entering: viewIn, exiting: viewOut })} style={styles.view}>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              <Text style={styles.description}>{description}</Text>
              {current === 'ending'
                ? <Text style={styles.meta}><Text style={styles.now}>{price}</Text> <Text style={styles.struck}>{laterPrice}</Text> {laterLabel}</Text>
                : <Text style={styles.meta}>{meta}</Text>}
              <Button style={styles.action} shape="pill" size="lg" trailingIcon={arrow} animated={animated} onPress={act} onPressIn={() => lean(1)} onPressOut={() => lean(0)}>{current === 'ending' ? endingActionLabel : actionLabel}</Button>
            </Animated.View>
          )}
        </LayoutAnimationConfig>
      </Card>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, gap: space[1], maxWidth: 358, padding: space[1], width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', minHeight: 40, paddingBottom: space[1.5], paddingLeft: space[3], paddingRight: space[2], paddingTop: space[2] },
  brand: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[1.5] },
  brandName: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  price: { ...type(14, c.textTertiary), lineHeight: 18 },
  timer: { flexDirection: 'row' },
  timerText: { color: c.textPrimary, fontFamily: font.mono, fontSize: 12, fontVariant: ['tabular-nums'] },
  inset: { minHeight: 226, padding: space[5] },
  view: { gap: space[1.5], minHeight: 186, minWidth: 0 },
  title: { ...type(16, c.textPrimary, '600'), flexShrink: 1, lineHeight: 20 },
  description: { ...type(14, c.textSecondary), lineHeight: 22 },
  meta: type(12, c.textTertiary),
  now: { color: c.textPrimary, fontWeight: '500' },
  struck: { textDecorationLine: 'line-through' },
  action: { marginTop: 'auto', width: '100%' },
  claimedTitle: { alignItems: 'center', flexDirection: 'row', gap: space[2.5] },
  mark: { alignItems: 'center', backgroundColor: c.success, borderRadius: radius.full, flexShrink: 0, height: 28, justifyContent: 'center', width: 28 },
})
