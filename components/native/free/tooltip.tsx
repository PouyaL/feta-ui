import { cloneElement, useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewInstance, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeIn, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { Kbd } from './kbd'
import { Copy, EASE_IN, EASE_OUT, Floating, Nub, useCompact, type FloatingMotion, type Side } from './popover'
import { Skeleton } from './skeleton'

const LONG_PRESS = 500
const RELEASE_HOLD = 1500
const GAP = 8
const NUB_HEIGHT = 7
const RICH_PIN = 30
const RICH_WIDTH = { phone: 300, tablet: 280 }
const HOLD_SCALE = 0.96
const REST_SPRING = { stiffness: 500, damping: 36 }

const SHOW = { duration: 140, easing: EASE_OUT }
const HIDE = { duration: 90, easing: EASE_IN }
const TIP_MOTION: FloatingMotion = { from: { opacity: 0, scale: HOLD_SCALE, shift: 4 }, open: SHOW, close: HIDE }
const RICH_MOTION: FloatingMotion = { from: { opacity: 0 }, open: SHOW, close: HIDE }

// One tooltip is open at a time across the app.
let active: { owner: string; close: () => void } | null = null

type TriggerProps = { accessibilityHint?: string; accessibilityLabel?: string }

type Shared = {
  /** The one element that shows it. Long press works on a disabled control too. */
  children: ReactElement<TriggerProps>
  /** Flips near an edge. Default `top`. */
  side?: Side
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** Milliseconds of long press before it shows. Default `500`. */
  delay?: number
  /** Set when the tooltip is the trigger's name, as on an icon only button. */
  labels?: boolean
  disabled?: boolean
  /** `false` turns off show, hide and the press. */
  animated?: boolean
}

type TipOptions = Shared & { spoken: string | undefined; sticky: boolean }

/** Long press in place of hover: the trigger sinks while held, and the tip outlives the release a moment. */
function useTip({ children, open: controlled, defaultOpen = false, onOpenChange, delay = LONG_PRESS, labels, disabled, animated = true, spoken, sticky }: TipOptions) {
  const still = useStill(animated)
  const id = useId()
  const anchor = useRef<ViewInstance>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [inner, setInner] = useState(defaultOpen)
  const open = !disabled && (controlled ?? inner)
  const sink = useSharedValue(1)

  const set = useCallback((next: boolean): void => {
    setInner(next)
    onOpenChange?.(next)
  }, [onOpenChange])

  const hide = useCallback((): void => {
    clearTimeout(timer.current)
    set(false)
    if (active?.owner === id) active = null
  }, [id, set])

  const show = useCallback((): void => {
    clearTimeout(timer.current)
    if (active && active.owner !== id) active.close()
    active = { owner: id, close: hide }
    set(true)
  }, [hide, id, set])

  const release = useCallback((): void => {
    clearTimeout(timer.current)
    if (!sticky) timer.current = setTimeout(hide, RELEASE_HOLD)
  }, [hide, sticky])

  useEffect(() => () => {
    clearTimeout(timer.current)
    if (active?.owner === id) active = null
  }, [id])

  const gesture = useMemo(() => Gesture.LongPress()
    .minDuration(delay)
    .enabled(!disabled)
    .onBegin(() => { if (!still) sink.value = withTiming(HOLD_SCALE, { duration: delay, easing: Easing.linear }) })
    .onStart(() => { runOnJS(show)() })
    .onFinalize((_, success) => {
      if (!still) sink.value = withSpring(1, REST_SPRING)
      if (success) runOnJS(release)()
    }), [delay, disabled, release, show, sink, still])

  const pressing = useAnimatedStyle(() => ({ transform: [{ scale: sink.value }] }))
  const speech = spoken === undefined ? {} : labels ? { accessibilityLabel: spoken } : { accessibilityHint: spoken }

  const trigger = (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[selfSized.anchor, pressing]}>
        <View ref={anchor} collapsable={false}>{cloneElement(children, speech)}</View>
      </Animated.View>
    </GestureDetector>
  )

  return { open, trigger, anchor, hide }
}

export type TooltipProps = Shared & {
  /** The label. Keep it short: there is no interactive content in a plain tooltip. */
  content: ReactNode
  /** Default `ink` for dense tool UI. `soft` sits with trays. */
  tone?: 'ink' | 'soft'
  /** Keys shown after the label, like `['⌘', 'S']`. */
  shortcut?: string[]
  /** Lead icon, 14 px. */
  icon?: ReactNode
}

/** A short label on long press. Screen readers get it as the trigger's hint or name. */
export function Tooltip({ content, tone = 'ink', shortcut, icon, side = 'top', ...shared }: TooltipProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const compact = useCompact()
  const ink = tone === 'ink'
  const tip = useTip({ ...shared, spoken: typeof content === 'string' ? content : undefined, sticky: false })
  const body = (
    <>
      {icon ?? null}
      <Copy style={[styles.label, !ink && styles.labelSoft]}>{content}</Copy>
      {shortcut ? <View style={styles.keys}>{shortcut.map((key) => <Kbd key={key} size="sm" variant={ink ? 'inverse' : 'outline'} animated={shared.animated ?? true}>{key}</Kbd>)}</View> : null}
    </>
  )
  return (
    <>
      {tip.trigger}
      <Floating anchor={tip.anchor} open={tip.open} side={side} offset={GAP + NUB_HEIGHT} nubInset={18} motion={TIP_MOTION} animated={shared.animated ?? true} onDismiss={tip.hide}>
        {(placed) => (
          <View accessibilityRole="text" style={[styles.tip, compact ? styles.tipPhone : styles.tipTablet, !ink && styles.tipSoft]}>
            {ink ? <View style={styles.row}>{body}</View> : <View style={[styles.row, styles.card]}>{body}</View>}
            <Nub placed={placed} fill={ink ? colors.inverse : colors.muted} />
          </View>
        )}
      </Floating>
    </>
  )
}

export type TooltipRichProps = Shared & {
  title: ReactNode
  /** The tab's lead: an icon, or a mark from Badge. */
  icon?: ReactNode
  description?: ReactNode
  /** Footer keys on the tray. */
  shortcut?: string[]
  /** Footer actions on the tray. At most one main action. Actions keep it open until a tap outside. */
  actions?: ReactNode
  /** Skeleton lines in the card. The swap to content fades. */
  loading?: boolean
}

/** A tooltip in the toast tab shape: a title tab, one line of help and an optional action. */
export function TooltipRich({ title, icon, description, shortcut, actions, loading = false, side = 'top', ...shared }: TooltipRichProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const compact = useCompact()
  const animated = shared.animated ?? true
  const still = useStill(animated)
  const tip = useTip({ ...shared, spoken: typeof description === 'string' ? description : undefined, sticky: Boolean(actions) })
  const vertical = side === 'bottom' ? 'bottom' : 'top'
  return (
    <>
      {tip.trigger}
      <Floating anchor={tip.anchor} open={tip.open} side={vertical} offset={GAP + NUB_HEIGHT} pin={RICH_PIN} nubInset={RICH_PIN} width={compact ? RICH_WIDTH.phone : RICH_WIDTH.tablet} motion={RICH_MOTION} animated={animated} onDismiss={tip.hide}>
        {(placed) => (
          <View accessibilityRole="text">
            <View style={styles.tab}>
              {icon ?? null}
              <Copy style={styles.tabTitle}>{title}</Copy>
            </View>
            <View style={styles.tray}>
              <View style={styles.richCard}>
                {loading ? (
                  <View accessibilityLabel="Loading" style={styles.lines}><Skeleton width="100%" height={8} animated={animated} /><Skeleton width="56%" height={8} animated={animated} /></View>
                ) : (
                  <Animated.View {...(still ? {} : { entering: FadeIn.duration(120) })}><Copy style={[styles.richText, compact && styles.richTextPhone]}>{description}</Copy></Animated.View>
                )}
              </View>
              {shortcut ? (
                <View style={styles.keyRow}>
                  <Text style={styles.caption}>Press</Text>
                  {shortcut.map((key) => <Kbd key={key} size="sm" variant="outline" animated={animated}>{key}</Kbd>)}
                </View>
              ) : null}
              {actions ? <View style={styles.actions}>{actions}</View> : null}
            </View>
            <Nub placed={placed} fill={colors.muted} />
          </View>
        )}
      </Floating>
    </>
  )
}

export type TooltipTruncatedProps = Omit<TooltipProps, 'content' | 'children'> & { children: string; style?: StyleProp<ViewStyle>; textStyle?: StyleProp<TextStyle> }

/** Text that cuts off, with a tooltip that holds the full value, only when it is actually cut. */
export function TooltipTruncated({ children, style, textStyle, ...rest }: TooltipTruncatedProps) {
  const styles = useThemed(createStyles)
  const [cut, setCut] = useState(false)
  return (
    <View style={style}>
      <Tooltip {...rest} content={children} disabled={!cut}>
        <Text numberOfLines={1} style={[styles.truncated, textStyle]}>{children}</Text>
      </Tooltip>
      {/* A full copy behind it reports how many lines the value really takes. */}
      <Text accessibilityElementsHidden importantForAccessibility="no" onTextLayout={(e) => setCut(e.nativeEvent.lines.length > 1)} style={[styles.truncated, styles.ghost, textStyle]}>{children}</Text>
    </View>
  )
}

const selfSized = StyleSheet.create({ anchor: { alignSelf: 'flex-start', maxWidth: '100%' } })

const createStyles = (c: Colors) => StyleSheet.create({
  tip: { backgroundColor: c.inverse, borderRadius: radius.xl, paddingHorizontal: space[3], paddingVertical: space[2] },
  tipPhone: { maxWidth: 260 },
  tipTablet: { maxWidth: 240 },
  tipSoft: { backgroundColor: c.muted, borderRadius: radius.control, padding: space[1] },
  row: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[1.5] },
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.xl, borderWidth: 1, paddingHorizontal: space[3], paddingVertical: space[2] },
  label: { ...type(13, c.textInverse, '500'), flexShrink: 1, lineHeight: 18 },
  labelSoft: { color: c.textPrimary },
  keys: { flexDirection: 'row', gap: space[0.5], marginLeft: space[0.5] },
  tab: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: c.muted, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, flexDirection: 'row', gap: space[2], height: 36, marginBottom: -2, paddingLeft: space[2.5], paddingRight: space[3.5] },
  tabTitle: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  tray: { backgroundColor: c.muted, borderBottomLeftRadius: radius.panel, borderBottomRightRadius: radius.panel, borderTopRightRadius: radius.panel, padding: space[1] },
  richCard: { backgroundColor: c.surface, borderRadius: radius['2xl'], paddingHorizontal: space[3.5], paddingVertical: space[3] },
  richText: { ...type(13, c.textSecondary), lineHeight: 18 },
  richTextPhone: { fontSize: 14, lineHeight: 20 },
  lines: { gap: space[2], paddingVertical: space[1] },
  keyRow: { alignItems: 'center', flexDirection: 'row', gap: space[1], paddingBottom: space[0.5], paddingHorizontal: space[2.5], paddingTop: space[1.5] },
  caption: { ...type(12, c.textSecondary), lineHeight: 16 },
  actions: { alignItems: 'center', flexDirection: 'row', gap: space[1], justifyContent: 'flex-end', paddingBottom: space[0.5], paddingHorizontal: space[0.5], paddingTop: space[1.5] },
  truncated: { ...type(14, c.textPrimary), lineHeight: 20 },
  ghost: { left: 0, opacity: 0, position: 'absolute', right: 0, top: 0 },
})
