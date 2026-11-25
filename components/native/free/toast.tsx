import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeOut, cancelAnimation, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { useCountdown } from './alert'
import { BadgeState, ToneGlyph, type BadgeStateKind } from './badge'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Progress } from './progress'

export type ToastKind = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'action' | 'undo' | 'promise'

const BADGE: Record<ToastKind, BadgeStateKind> = { success: 'success', error: 'error', warning: 'warning', info: 'info', loading: 'loading', action: 'action', undo: 'info', promise: 'loading' }

const ENTER_MS = 240
const FADE_MS = 120
const MELT = { duration: 600, dampingRatio: 0.75 } as const
const STACK_SPRING = { stiffness: 420, damping: 36 } as const
const SLIDE_SPRING = { stiffness: 420, damping: 34 } as const
const EXPAND_DELAY_MS = 150
const TIMEOUT_MS = 6000
const COLLAPSE_BEFORE_MS = 2000
const UNDO_MS = 5000
const FLY_OUT_MS = 200
const MAX_SHOWN = 3
const SWIPE_SHARE = 0.4
const PEEK = [0, 38, 74] as const
const SCALE = [1, 0.96, 0.92] as const
const GAP = 8
const TOAST_WIDTH = 358
const FILLET = 12
const RING_R = 6.5
const RING_LENGTH = 2 * Math.PI * RING_R
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
export type ToastData = {
  kind: ToastKind
  title: string
  description?: string
  /** The main button. */
  action?: { label: string; onPress: () => void }
  /** The quiet button beside it, like Later. */
  cancel?: { label: string; onPress?: () => void }
  /** 0 to 100, for Loading and Promise. */
  progress?: number
  /** Mono text beside the bar, like 2 OF 3. */
  meta?: string
  /** Milliseconds, or `Infinity` to stay. Loading and Promise stay by default. */
  duration?: number
}

export type ToastProps = ToastData & {
  /** Collapsed is the pill, Expanded has actions, Message has only text. */
  shape?: 'collapsed' | 'expanded' | 'message'
  onDismiss?: () => void
  /** Holds the undo ring. */
  paused?: boolean
  /**
   * Set by Toaster: the title becomes the button that pins the toast open or fans the stack out. It sits beside
   * Dismiss and the actions instead of wrapping them, so screen readers reach every control.
   */
  onTitlePress?: () => void
  /** Set by Toaster with onTitlePress: whether the toast is pinned open. */
  titleExpanded?: boolean
  /** Icons for the Undo and Retry buttons. */
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function UndoRing({ paused, animated, still, styles, ink }: { paused: boolean; animated: boolean; still: boolean; styles: ReturnType<typeof makeStyles>; ink: string }) {
  const [left, setLeft] = useState(UNDO_MS / 1000)
  const sweep = useSharedValue(0)
  useEffect(() => {
    if (paused) return undefined
    const timer = setInterval(() => setLeft((s) => Math.max(s - 1, 0)), 1000)
    return () => clearInterval(timer)
  }, [paused])
  useEffect(() => {
    if (!animated) return undefined
    if (paused) {
      cancelAnimation(sweep)
      return undefined
    }
    sweep.value = withTiming(1, { duration: UNDO_MS * (1 - sweep.value), easing: Easing.linear })
    return () => cancelAnimation(sweep)
  }, [paused, animated, sweep])
  const ring = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH * sweep.value }))
  return (
    <View style={styles.undo}>
      {still ? null : (
        <Svg aria-hidden width={16} height={16} viewBox="0 0 16 16" fill="none" style={styles.ring}>
          <AnimatedCircle animatedProps={ring} cx={8} cy={8} r={RING_R} stroke={ink} strokeWidth={1.5} strokeDasharray={[RING_LENGTH, RING_LENGTH]} />
        </Svg>
      )}
      <Text style={styles.mono}>{left}S</Text>
    </View>
  )
}

/** The pill that melts into a card. Use `toast()` to show one; render this alone for previews. */
export function Toast({ kind, title, description, action, cancel, progress, meta, shape = 'expanded', onDismiss, paused = false, onTitlePress, titleExpanded = false, renderIcon, animated = true, style }: ToastProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const collapsed = shape === 'collapsed'
  const undo = kind === 'undo'
  const hasBar = progress !== undefined
  const melt = useSharedValue(still ? 1 : 0)
  const copy = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    if (collapsed || still) {
      melt.value = collapsed ? 0 : 1
      copy.value = collapsed ? 0 : 1
      return
    }
    melt.value = 0
    copy.value = 0
    melt.value = withSpring(1, MELT)
    copy.value = withDelay(120, withTiming(1, { duration: 200, easing: OUT }))
  }, [collapsed, still, melt, copy])
  const tray = useAnimatedStyle(() => ({ opacity: Math.min(melt.value, 1), transform: [{ scaleY: 0.5 + 0.5 * melt.value }] }))
  const line = useAnimatedStyle(() => ({ opacity: copy.value }))
  const leading = undo ? renderIcon?.('undo', 16) : kind === 'error' ? renderIcon?.('refresh-cw', 16) : undefined
  return (
    <View accessibilityRole={kind === 'error' ? 'alert' : undefined} accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'} style={[collapsed ? styles.toastCollapsed : styles.toast, style]}>
      <View style={styles.head}>
        <View style={[styles.tab, collapsed ? styles.tabCollapsed : null]}>
          <BadgeState state={BADGE[kind]} label={null} animated={animated} />
          {onTitlePress ? (
            <Pressable accessibilityRole="button" accessibilityLabel={title} aria-expanded={titleExpanded} accessibilityHint="Shows the full notification" onPress={onTitlePress} style={styles.titlePress}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
            </Pressable>
          ) : <Text style={styles.title} numberOfLines={1}>{title}</Text>}
          {collapsed && hasBar ? <Text style={styles.mono}>{Math.round(progress)}%</Text> : null}
          {collapsed && undo && action ? (
            <Pressable accessibilityRole="button" accessibilityLabel={action.label} hitSlop={12} onPress={action.onPress} style={styles.inlineAction}>
              <Text style={styles.inlineActionText}>{action.label}</Text>
            </Pressable>
          ) : null}
          {collapsed ? null : (
            <Svg aria-hidden width={FILLET} height={FILLET} style={styles.fillet}>
              <Path d={`M0 0 A${FILLET} ${FILLET} 0 0 0 ${FILLET} ${FILLET} L0 ${FILLET} Z`} fill={colors.muted} />
            </Svg>
          )}
        </View>
        {!collapsed && onDismiss ? <IconButton variant="ghost" size="sm" icon={<ToneGlyph tone="danger" size={16} color={colors.textSecondary} />} label="Dismiss" onPress={onDismiss} animated={animated} /> : null}
      </View>
      {collapsed ? null : (
        <Animated.View style={[styles.tray, tray]}>
          <View style={styles.card}>
            {description ? <Animated.Text style={[styles.description, line]}>{description}</Animated.Text> : null}
            {hasBar ? (
              <View style={styles.barRow}>
                <Progress size="sm" value={progress} label={title} animated={animated} style={styles.bar} />
                <Text style={styles.mono}>{meta ?? `${Math.round(progress)}%`}</Text>
              </View>
            ) : null}
            {shape === 'expanded' && (action || cancel || undo) ? (
              <View style={[styles.actions, undo ? styles.actionsUndo : null]}>
                {undo ? <UndoRing paused={paused} animated={animated} still={still} styles={styles} ink={colors.textTertiary} /> : null}
                {cancel ? <Button variant="ghost" size="sm" animated={animated} {...(cancel.onPress ? { onPress: cancel.onPress } : {})}>{cancel.label}</Button> : null}
                {action ? <Button variant={kind === 'action' || kind === 'info' ? 'primary' : 'secondary'} size="sm" animated={animated} onPress={action.onPress} {...(leading ? { leadingIcon: leading } : {})}>{action.label}</Button> : null}
              </View>
            ) : null}
          </View>
        </Animated.View>
      )}
    </View>
  )
}

type Entry = ToastData & { id: number }

let entries: Entry[] = []
let nextId = 1
const listeners = new Set<() => void>()
const publish = (next: Entry[]): void => { entries = next; for (const listen of listeners) listen() }
const subscribe = (listen: () => void): (() => void) => { listeners.add(listen); return () => { listeners.delete(listen) } }

/** Shows a toast and returns its id. Needs one `<Toaster />` in the app. */
export function toast(data: ToastData): number {
  const id = nextId++
  publish([{ ...data, id }, ...entries])
  return id
}

/** Changes a toast in place, like moving a Promise on to success. */
toast.update = (id: number, patch: Partial<ToastData>): void => publish(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
toast.dismiss = (id: number): void => publish(entries.filter((entry) => entry.id !== id))
/** Runs a promise through Promise, then Success or Error. */
toast.promise = async <T,>(work: Promise<T>, copy: { title: string; description?: string; success: string; error: string }): Promise<T> => {
  const id = toast({ kind: 'promise', title: copy.title, progress: 0, ...(copy.description ? { description: copy.description } : {}) })
  try {
    const result = await work
    toast.update(id, { kind: 'success', title: copy.success, duration: TIMEOUT_MS })
    return result
  } catch (error) {
    toast.update(id, { kind: 'error', title: copy.error, duration: TIMEOUT_MS })
    throw error
  }
}

export type ToasterProps = {
  /** Default `bottom`. */
  position?: 'top' | 'bottom'
  /** Distance from the screen edge. Pass your safe area inset plus 8. Default 8. */
  inset?: number
  renderIcon?: RenderIcon
  animated?: boolean
}

type ItemProps = { entry: Entry; index: number; heights: number[]; spread: boolean; top: boolean; animated: boolean; renderIcon: RenderIcon | undefined; onHeight: (id: number, height: number) => void; onSpread: (on: boolean) => void }

function Item({ entry, index, heights, spread, top, animated, renderIcon, onHeight, onSpread }: ItemProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const stays = entry.kind === 'loading' || entry.kind === 'promise'
  const total = entry.duration ?? (entry.kind === 'undo' ? UNDO_MS : stays ? Infinity : TIMEOUT_MS)
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const paused = pinned || spread
  const dismiss = (): void => toast.dismiss(entry.id)
  useCountdown(Number.isFinite(total) ? total : null, paused, dismiss)
  useCountdown(Number.isFinite(total) ? total - COLLAPSE_BEFORE_MS : null, paused, () => setOpen(false))
  useEffect(() => {
    const timer = setTimeout(() => setOpen(true), still ? 0 : EXPAND_DELAY_MS)
    return () => clearTimeout(timer)
  }, [still])

  const expanded = open || pinned
  const direction = top ? 1 : -1
  const offset = spread
    ? heights.slice(0, index).reduce((sum, height) => sum + height + GAP, 0)
    // Stacked toasts line up by their tabs, so a shorter one rises by the difference.
    : (PEEK[index] ?? PEEK[2]) + Math.max((heights[0] ?? 0) - (heights[index] ?? 0), 0)
  const scaleTo = spread ? 1 : (SCALE[index] ?? SCALE[2])
  const hasActions = Boolean(entry.action || entry.cancel) || entry.kind === 'undo' || entry.progress !== undefined
  const shape = !expanded ? 'collapsed' : hasActions ? 'expanded' : 'message'

  const y = useSharedValue(still ? direction * offset : direction * (offset - 6))
  const scale = useSharedValue(still ? scaleTo : 0.95)
  const opacity = useSharedValue(0)
  const x = useSharedValue(0)
  const wide = useSharedValue(TOAST_WIDTH)
  useEffect(() => {
    const target = index >= MAX_SHOWN ? 0 : 1
    const front = { duration: ENTER_MS, easing: OUT }
    if (still) {
      y.value = direction * offset
      scale.value = scaleTo
      opacity.value = target
      return
    }
    opacity.value = withTiming(target, front)
    y.value = index === 0 ? withTiming(direction * offset, front) : withSpring(direction * offset, STACK_SPRING)
    scale.value = index === 0 ? withTiming(scaleTo, front) : withSpring(scaleTo, STACK_SPRING)
  }, [index, offset, scaleTo, direction, still, y, scale, opacity])

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => { x.value = e.translationX })
    .onEnd((e) => {
      if (Math.abs(e.translationX) < wide.value * SWIPE_SHARE) {
        x.value = withSpring(0, SLIDE_SPRING)
      } else if (still) {
        runOnJS(dismiss)()
      } else {
        x.value = withTiming(Math.sign(e.translationX) * wide.value * 1.2, { duration: FLY_OUT_MS }, (done) => { if (done) runOnJS(dismiss)() })
      }
    })

  const stacked = useAnimatedStyle(() => ({
    opacity: opacity.value * (1 - Math.min(Math.abs(x.value) / (wide.value * 0.7), 1)),
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }))

  /** Tap stands in for hover: the back of the stack fans out, the front toast stays open and stops counting. */
  function tap(): void {
    if (index > 0 || spread) onSpread(!spread)
    else setPinned(!pinned)
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        exiting={FadeOut.duration(animated ? FADE_MS : 0)}
        pointerEvents={index >= MAX_SHOWN ? 'none' : 'auto'}
        onLayout={(e) => {
          wide.value = e.nativeEvent.layout.width
          onHeight(entry.id, e.nativeEvent.layout.height)
        }}
        style={[styles.item, top ? styles.itemTop : styles.itemBottom]}
      >
        {/* The stack motion sits on its own layer: a layout animation would overwrite opacity on the same view. */}
        <Animated.View style={[styles.stackLayer, top ? styles.originTop : styles.originBottom, stacked]}>
          {/* A tap anywhere on the toast works by touch; the title is the button screen readers use (see Toast). */}
          <Pressable accessible={false} tabIndex={-1} onPress={tap}>
            <Toast {...entry} shape={shape} paused={paused} onTitlePress={tap} titleExpanded={expanded} animated={animated} onDismiss={dismiss} {...(renderIcon ? { renderIcon } : {})} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

/** Where toasts land. At most three show, older ones stack behind as tabs. Tap the stack to fan it out. */
export function Toaster({ position = 'bottom', inset = 8, renderIcon, animated = true }: ToasterProps) {
  const styles = useThemed(makeStyles)
  const list = useSyncExternalStore(subscribe, () => entries)
  const [spread, setSpread] = useState(false)
  const [heights, setHeights] = useState<Record<number, number>>({})
  const top = position === 'top'
  const measured = list.map(({ id }) => heights[id] ?? 40)
  const place = useMemo(() => (top ? { top: inset } : { bottom: inset }), [top, inset])
  return (
    <View pointerEvents="box-none" role="region" accessibilityLabel="Notifications" accessibilityLiveRegion="polite" style={[styles.region, place]}>
      {list.map((entry, index) => (
        <Item
          key={entry.id}
          entry={entry}
          index={index}
          heights={measured}
          spread={spread}
          top={top}
          animated={animated}
          renderIcon={renderIcon}
          onHeight={(id, height) => setHeights((prev) => (prev[id] === height ? prev : { ...prev, [id]: height }))}
          onSpread={setSpread}
        />
      ))}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  toast: { width: TOAST_WIDTH, maxWidth: '100%' },
  toastCollapsed: { alignSelf: 'flex-start', maxWidth: TOAST_WIDTH },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tab: { flexDirection: 'row', alignItems: 'center', height: 44, minWidth: 0, flexShrink: 1, paddingLeft: space[2], paddingRight: space[4], gap: space[2], borderTopLeftRadius: radius.panel, borderTopRightRadius: radius.panel, backgroundColor: c.muted },
  tabCollapsed: { borderRadius: radius.full },
  fillet: { position: 'absolute', left: '100%', bottom: 0 },
  title: { ...type(14, c.textPrimary, '500'), flexShrink: 1, lineHeight: 16 },
  titlePress: { flexShrink: 1, minWidth: 0 },
  tray: { padding: space[1], borderTopRightRadius: radius.tray, borderBottomLeftRadius: radius.tray, borderBottomRightRadius: radius.tray, backgroundColor: c.muted, transformOrigin: 'top' },
  card: { gap: space[3], paddingVertical: space[3.5], paddingHorizontal: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  description: { ...type(14, c.textSecondary), lineHeight: 20 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  bar: { flex: 1, width: undefined },
  mono: type(11, c.textTertiary, '400', true),
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: space[2] },
  actionsUndo: { justifyContent: 'space-between' },
  inlineAction: { marginLeft: space[3] },
  inlineActionText: type(13, c.textSecondary),
  undo: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  ring: { transform: [{ rotate: '-90deg' }] },
  region: { position: 'absolute', left: space[4], right: space[4] },
  item: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  stackLayer: { alignSelf: 'stretch', alignItems: 'center' },
  itemTop: { top: 0 },
  itemBottom: { bottom: 0 },
  originTop: { transformOrigin: 'top' },
  originBottom: { transformOrigin: 'bottom' },
})
