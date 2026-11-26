import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewInstance, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeInUp, FadeOut, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, softElevation, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Copy, EASE_IN, EASE_OUT, Floating, Mark, Nub, openLink, Tap, type FloatingMotion, type Side } from './popover'
import { Skeleton } from './skeleton'

const OFFSET = 12
const LONG_PRESS = 500
const WIDTH = 320
const SWAP_MS = 200
const PIN_IN = FadeInUp.duration(220).withInitialValues({ transform: [{ translateY: -4 }] })
const SKELETON_OUT = FadeOut.duration(SWAP_MS).easing(EASE_OUT)

const MOTION: FloatingMotion = { from: { opacity: 0, scale: 0.96, shift: 4 }, exitScale: 0.98, open: { duration: 180, dampingRatio: 0.7 }, close: { duration: 120, easing: EASE_IN } }

export type HoverCardProps = {
  /** The link text. The link leads to the same content as the card. */
  label: ReactNode
  /** Where a tap goes, when there is no `onPress`. */
  href?: string
  onPress?: () => void
  /** Spoken name, when `label` is not a string. */
  accessibilityLabel?: string
  /** Card content, on the inset surface. */
  children: ReactNode
  /** Inset at the top of the card, 120 to 140 high. */
  media?: ReactNode
  /** Stats and actions on the tray. */
  tray?: ReactNode
  /** The action at the top of the card. When pinned, it swaps to close. */
  action?: ReactNode
  /** Skeleton of the same shape, then a cross fade with no layout shift. */
  loading?: boolean
  /** Flips when there is no room. Default `top`. */
  side?: Side
  /** A long press keeps it open until closed from the card. Default `true`. */
  pinnable?: boolean
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  defaultPinned?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
  labelStyle?: StyleProp<TextStyle>
}

/** A preview of what sits behind a link. With no hover on touch, a long press opens it and a tap follows the link. */
export function HoverCard({ label, href, onPress, accessibilityLabel, children, media, tray, action, loading = false, side = 'top', pinnable = true, open: controlled, defaultOpen = false, onOpenChange, defaultPinned = false, animated = true, style, labelStyle }: HoverCardProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const anchor = useRef<ViewInstance>(null)
  const [inner, setInner] = useState(defaultOpen || defaultPinned)
  const [pinned, setPinned] = useState(defaultPinned)
  const open = controlled ?? inner
  const content = useSharedValue(loading ? 0 : 1)

  function set(next: boolean): void {
    setInner(next)
    onOpenChange?.(next)
    if (!next) setPinned(false)
  }
  const latest = useRef(set)
  useEffect(() => { latest.current = set })

  useEffect(() => {
    content.value = withTiming(loading ? 0 : 1, { duration: still ? 0 : SWAP_MS, easing: EASE_OUT })
  }, [content, loading, still])

  const gesture = useMemo(() => {
    const reveal = (): void => {
      latest.current(true)
      if (pinnable) setPinned(true)
    }
    return Gesture.LongPress().minDuration(LONG_PRESS).onStart(() => { runOnJS(reveal)() })
  }, [pinnable])

  const shown = useAnimatedStyle(() => ({ opacity: content.value }))
  const spoken = accessibilityLabel ?? (typeof label === 'string' ? label : undefined)

  return (
    <>
      <GestureDetector gesture={gesture}>
        <View ref={anchor} collapsable={false} style={[styles.anchor, style]}>
          <Tap
            accessibilityRole="link"
            accessibilityLabel={spoken}
            accessibilityHint="Long press for a preview"
            aria-expanded={open}
            accessibilityActions={[{ name: 'longpress', label: 'Show preview' }]}
            onAccessibilityAction={() => set(true)}
            animated={animated}
            onPress={() => { if (onPress) onPress(); else if (href) openLink(href) }}
            style={styles.trigger}
          >
            <Copy style={[styles.link, labelStyle]}>{label}</Copy>
          </Tap>
        </View>
      </GestureDetector>
      <Floating anchor={anchor} open={open} side={side} offset={OFFSET} nubInset={26} width={WIDTH} motion={MOTION} animated={animated} onDismiss={() => { if (!pinned) set(false) }}>
        {(placed) => (
          <View accessibilityLabel="Preview" style={styles.card}>
            <View style={styles.body}>
              <Animated.View aria-hidden={loading} style={[styles.content, shown]}>
                {pinned ? <View style={styles.close}><IconButton variant="ghost" size="sm" label="Close" animated={animated} icon={<Mark name="x" />} onPress={() => set(false)} /></View> : action ? <View style={styles.close}>{action}</View> : null}
                {media ? <View style={styles.media}>{media}</View> : null}
                {children}
                {pinned ? <Animated.View {...(still ? {} : { entering: PIN_IN })}><Text style={styles.pinned}>Pinned open</Text></Animated.View> : null}
              </Animated.View>
              {loading ? (
                <Animated.View {...(still ? {} : { exiting: SKELETON_OUT })} accessibilityLabel="Loading" style={styles.skeleton}>
                  <View style={styles.row}>
                    <Skeleton shape="circle" width={40} height={40} animated={animated} />
                    <View style={styles.stack}><Skeleton width="40%" height={12} animated={animated} /><Skeleton width="60%" height={8} animated={animated} /></View>
                  </View>
                  <Skeleton width="100%" height={8} animated={animated} />
                  <Skeleton width="72%" height={8} animated={animated} />
                </Animated.View>
              ) : null}
            </View>
            {tray ? <View style={styles.tray}>{tray}</View> : null}
            <Nub placed={placed} fill={colors.muted} />
          </View>
        )}
      </Floating>
    </>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  anchor: { alignSelf: 'flex-start' },
  trigger: { justifyContent: 'center', minHeight: 44 },
  link: { ...type(14, c.textPrimary, '500'), lineHeight: 20, textDecorationLine: 'underline' },
  card: { boxShadow: softElevation(c), backgroundColor: c.muted, borderRadius: radius.tray, padding: space[1] },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', padding: space[4] },
  content: { gap: space[3] },
  close: { position: 'absolute', right: 0, top: 0, zIndex: 1 },
  media: { borderRadius: radius.xl, height: 130, overflow: 'hidden' },
  pinned: { ...type(12, c.textSecondary), lineHeight: 16 },
  skeleton: { ...StyleSheet.absoluteFill, gap: space[3], padding: space[4] },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  stack: { flex: 1, gap: space[2] },
  tray: { paddingHorizontal: space[3], paddingVertical: space[2.5] },
})
