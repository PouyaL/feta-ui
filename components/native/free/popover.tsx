import { cloneElement, useEffect, useRef, useState, type ReactElement, type ReactNode, type RefObject } from 'react'
import { Modal as NativeModal, Pressable, StyleSheet, Text, View, useWindowDimensions, type AccessibilityState, type LayoutChangeEvent, type PressableProps, type StyleProp, type TextStyle, type ViewInstance, type ViewStyle } from 'react-native'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated'
import Svg, { Circle, Path, Polyline } from 'react-native-svg'
import { press, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const EDGE = 8
const OFFSET = 10
const NUB_INSET = 24
const PHONE_PANEL = 320
const PHONE_MAX = 640
const FADE_MS = 150

export const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
export const EASE_IN = Easing.bezierFn(0.4, 0, 1, 1)
export const EASE_IN_OUT = Easing.bezierFn(0.65, 0, 0.35, 1)

const OPEN: WithSpringConfig = { duration: 180, dampingRatio: 0.7 }
const CLOSE: WithTimingConfig = { duration: 120, easing: EASE_IN }

/** Modals only rotate with the app when they are told to. */
export const ORIENTATIONS = ['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right'] as const

/** A timed or spring move, as the web tokens describe them. */
export type Transition = WithTimingConfig | WithSpringConfig

const isSpring = (transition: Transition): transition is WithSpringConfig => 'stiffness' in transition || 'dampingRatio' in transition

/** Starts a UI thread animation from the JS thread, with a JS callback when it lands. */
export function animateTo(to: number, transition: Transition, done?: () => void): number {
  const finish = (finished?: boolean): void => {
    'worklet'
    if (finished && done) runOnJS(done)()
  }
  return isSpring(transition) ? withSpring(to, transition, finish) : withTiming(to, transition, finish)
}

/** Phones get the Mobile layout, by the same 640 rule as the web tokens. */
export const useCompact = (): boolean => useWindowDimensions().width <= PHONE_MAX

/** The soft elevation. kit.ts has no shadow color yet, so it borrows the ink hairline. */
export const soft = (c: Colors): ViewStyle => ({ elevation: 4, shadowColor: c.ink10, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 10 })

export { openLink } from '../kit'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export type TapProps = Omit<PressableProps, 'style' | 'children'> & { animated?: boolean; style?: StyleProp<ViewStyle>; children?: ReactNode }

/** A Pressable with the shared press spring. */
export function Tap({ animated = true, style, children, onPressIn, onPressOut, ...rest }: TapProps) {
  const still = useStill(animated)
  const scale = useSharedValue(1)
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <AnimatedPressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => { onPressIn?.(e); if (!still) scale.value = withSpring(press.scale, press.spring) }}
      onPressOut={(e) => { onPressOut?.(e); if (!still) scale.value = withSpring(1, press.spring) }}
      style={[style, pressed]}
    >
      {children}
    </AnimatedPressable>
  )
}

const STROKES = {
  'chevron-left': ['15,5 8,12 15,19'],
  'chevron-right': ['9,5 16,12 9,19'],
  'chevron-up': ['5,15 12,8 19,15'],
  'arrow-down': ['12,4 12,20', '6,14 12,20 18,14'],
  x: ['6,6 18,18', '18,6 6,18'],
  tick: ['5,13 10,18 19,7'],
  plus: ['12,5 12,19', '5,12 19,12'],
  more: ['5,12 5.01,12', '12,12 12.01,12', '19,12 19.01,12'],
  search: ['16,16 20,20'],
} as const

export type MarkName = keyof typeof STROKES

/** A plain stroke for control chrome, such as a chevron or a close cross. Content icons come in through props. */
export function Mark({ name, size = 16, color }: { name: MarkName; size?: number; color?: string }) {
  const colors = useColors()
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'search' ? <Circle cx={11} cy={11} r={6.5} stroke={color ?? colors.textPrimary} strokeWidth={1.5} /> : null}
      {STROKES[name].map((points) => <Polyline key={points} points={points} stroke={color ?? colors.textPrimary} strokeWidth={name === 'more' ? 2.5 : 1.5} strokeLinecap="round" strokeLinejoin="round" />)}
    </Svg>
  )
}

/** Sets a string in the given style, and leaves any other node alone. */
export function Copy({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  if (typeof children === 'string' || typeof children === 'number') return <Text style={style} numberOfLines={numberOfLines}>{children}</Text>
  return <>{children}</>
}

export type Side = 'top' | 'bottom' | 'left' | 'right'
export type Align = 'start' | 'center' | 'end'
export type Point = { x: number; y: number }
export type Placed = { side: Side; nub: number }

type Box = Point & { width: number; height: number }
type Spot = Placed & { left: number; top: number }

const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }

/** Start offset for a panel that moves `px` toward its trigger as it opens. */
export const towardTrigger = (side: Side, px: number): Point => ({
  x: side === 'left' ? px : side === 'right' ? -px : 0,
  y: side === 'top' ? px : side === 'bottom' ? -px : 0,
})

type Fit = { side: Side; align: Align; offset: number; pin: number | undefined; inset: number; viewWidth: number; viewHeight: number }

function measure(anchor: Box, width: number, height: number, { side, align, offset, pin, inset, viewWidth, viewHeight }: Fit): Spot {
  const right = anchor.x + anchor.width
  const bottom = anchor.y + anchor.height
  const fits = (s: Side): boolean =>
    s === 'top' ? anchor.y - offset - height >= EDGE
    : s === 'bottom' ? bottom + offset + height <= viewHeight - EDGE
    : s === 'left' ? anchor.x - offset - width >= EDGE
    : right + offset + width <= viewWidth - EDGE
  const placed = fits(side) || !fits(OPPOSITE[side]) ? side : OPPOSITE[side]
  const vertical = placed === 'top' || placed === 'bottom'
  const start = vertical ? anchor.x : anchor.y
  const length = vertical ? anchor.width : anchor.height
  const size = vertical ? width : height
  const limit = vertical ? viewWidth : viewHeight
  const center = start + length / 2
  const wanted = pin !== undefined ? center - pin : align === 'start' ? start : align === 'end' ? start + length - size : center - size / 2
  const along = Math.max(EDGE, Math.min(wanted, limit - EDGE - size))
  const across = placed === 'top' ? anchor.y - offset - height : placed === 'bottom' ? bottom + offset : placed === 'left' ? anchor.x - offset - width : right + offset
  const nub = Math.max(inset, Math.min(center - along, size - inset))
  return vertical ? { left: along, top: across, side: placed, nub } : { left: across, top: along, side: placed, nub }
}

export type FloatingMotion = {
  /** Where the panel starts. `shift` moves it toward the trigger. */
  from: { opacity?: number; scale?: number; shift?: number }
  /** Scale it leaves at. Default 1. */
  exitScale?: number
  open: Transition
  close: Transition
}

export type FloatingProps = {
  /** Wrap the trigger in a View with `collapsable={false}` and pass its ref. */
  anchor: RefObject<ViewInstance | null>
  /** Change it to measure again when `anchor` moves to another element. */
  anchorKey?: string | number | undefined
  open: boolean
  side?: Side
  align?: Align
  /** Gap to the trigger. */
  offset?: number
  /** Keeps the nub this far from the panel's start edge, instead of using `align`. */
  pin?: number
  /** Closest the nub centre gets to a corner. */
  nubInset?: number
  /** Panel width. Without it the panel fits its content. */
  width?: number
  motion: FloatingMotion
  animated?: boolean
  /** A tap outside, with where it landed, or the Android back button with no point. */
  onDismiss?: (point?: Point) => void
  /** Receives the side after flipping, and where the nub sits. */
  children: (placed: Placed) => ReactElement
}

/**
 * An anchored layer. A native Modal is the one surface nothing clips, so the panel measures its trigger in
 * the window, lays out hidden once to learn its own size, and only then moves in from its final side.
 */
export function Floating({ anchor, anchorKey, open, side = 'bottom', align = 'center', offset = 8, pin, nubInset = NUB_INSET, width, motion, animated = true, onDismiss, children }: FloatingProps) {
  const still = useStill(animated)
  const fades = animated && still
  const view = useWindowDimensions()
  const [present, setPresent] = useState(open)
  const [box, setBox] = useState<Box | null>(null)
  const [spot, setSpot] = useState<Spot | null>(null)
  const size = useRef({ width: 0, height: 0 })
  const entered = useRef(false)
  const opacity = useSharedValue(0)
  const scale = useSharedValue(1)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const frame = useSharedValue({ left: 0, top: 0, originX: 0, originY: 0 })
  const limit = view.width - EDGE * 2
  const wide = width === undefined ? null : Math.min(width, limit)
  if (open && !present) setPresent(true)

  function settle(from: Box): void {
    const next = measure(from, size.current.width, size.current.height, { side, align, offset, pin, inset: nubInset, viewWidth: view.width, viewHeight: view.height })
    const vertical = next.side === 'top' || next.side === 'bottom'
    frame.value = {
      left: next.left,
      top: next.top,
      originX: vertical ? next.nub : next.side === 'left' ? size.current.width : 0,
      originY: vertical ? (next.side === 'top' ? size.current.height : 0) : next.nub,
    }
    setSpot((held) => (held && held.left === next.left && held.top === next.top && held.nub === next.nub && held.side === next.side ? held : next))
  }

  useEffect(() => {
    if (!present) return undefined
    const handle = requestAnimationFrame(() => {
      anchor.current?.measureInWindow((left, top, boxWidth, boxHeight) => {
        const next = { x: left, y: top, width: boxWidth, height: boxHeight }
        setBox(next)
        if (size.current.width) settle(next)
      })
    })
    return () => cancelAnimationFrame(handle)
    // `settle` closes over props that re-run this through the listed values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [present, anchor, anchorKey, view.width, view.height])

  useEffect(() => {
    if (!spot || !open || entered.current) return
    entered.current = true
    if (still) {
      if (fades) { opacity.value = 0; opacity.value = withTiming(1, { duration: FADE_MS }) } else opacity.value = 1
      scale.value = 1
      x.value = 0
      y.value = 0
      return
    }
    const start = towardTrigger(spot.side, motion.from.shift ?? 0)
    opacity.value = motion.from.opacity ?? 0
    scale.value = motion.from.scale ?? 1
    x.value = start.x
    y.value = start.y
    opacity.value = animateTo(1, motion.open)
    scale.value = animateTo(1, motion.open)
    x.value = animateTo(0, motion.open)
    y.value = animateTo(0, motion.open)
  }, [spot, open, still, fades, motion, opacity, scale, x, y])

  useEffect(() => {
    if (open || !present) return
    const finish = (): void => {
      entered.current = false
      opacity.value = 0
      size.current = { width: 0, height: 0 }
      setPresent(false)
      setBox(null)
      setSpot(null)
    }
    if (!entered.current || (still && !fades)) { finish(); return }
    opacity.value = animateTo(0, still ? { duration: FADE_MS } : motion.close, finish)
    if (!still && motion.exitScale !== undefined) scale.value = animateTo(motion.exitScale, motion.close)
  }, [open, present, still, fades, motion, opacity, scale])

  const panel = useAnimatedStyle(() => {
    const at = frame.value
    return {
      opacity: opacity.value,
      left: at.left,
      top: at.top,
      maxWidth: limit,
      ...(wide === null ? {} : { width: wide }),
      transformOrigin: [at.originX, at.originY, 0],
      transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
    }
  }, [limit, wide])

  function onLayout(e: LayoutChangeEvent): void {
    const { width: panelWidth, height: panelHeight } = e.nativeEvent.layout
    size.current = { width: panelWidth, height: panelHeight }
    if (box) settle(box)
  }

  return (
    <NativeModal transparent visible={present} animationType="none" supportedOrientations={[...ORIENTATIONS]} onRequestClose={() => onDismiss?.()}>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={(e) => onDismiss?.({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY })} />
      {box ? <Animated.View accessibilityViewIsModal onLayout={onLayout} style={[layer.floating, panel]}>{children(spot ?? { side, nub: 0 })}</Animated.View> : null}
    </NativeModal>
  )
}

const NUB_PATH = 'M16 0C13 0 11.2 1.6 9.6 4.6 9 5.8 8.6 6.6 8 6.6S7 5.8 6.4 4.6C4.8 1.6 3 0 0 0Z'
const NUB_TURN: Record<Side, string> = { top: '0deg', bottom: '180deg', left: '-90deg', right: '90deg' }

/** The small point on an anchored panel, in the panel's fill. It stays over the trigger's centre. */
export function Nub({ placed, fill, wash }: { placed: Placed; fill: string; wash?: string }) {
  const { side, nub } = placed
  const turn = NUB_TURN[side]
  const spot = useAnimatedStyle(() => {
    const vertical = side === 'top' || side === 'bottom'
    return {
      left: vertical ? nub - 8 : side === 'right' ? -11 : 'auto',
      right: side === 'left' ? -11 : 'auto',
      top: vertical ? (side === 'bottom' ? -7 : 'auto') : nub - 4,
      bottom: side === 'top' ? -7 : 'auto',
      transform: [{ rotate: turn }],
    }
  }, [side, nub, turn])
  return (
    <Animated.View pointerEvents="none" style={[layer.nub, spot]}>
      <Svg width={16} height={8} viewBox="0 0 16 8">
        <Path d={NUB_PATH} fill={fill} />
        {wash ? <Path d={NUB_PATH} fill={wash} /> : null}
      </Svg>
    </Animated.View>
  )
}

export type PopoverTriggerProps = Omit<TapProps, 'children'> & {
  /** The label. */
  children: ReactNode
  /** Lead icon, 16 px. */
  icon?: ReactNode
}

/** The pill that opens anchored context. Any button can open a Popover; this one has an Open state. */
export function PopoverTrigger({ children, icon, disabled, style, accessibilityState, 'aria-expanded': ariaExpanded, ...rest }: PopoverTriggerProps) {
  const styles = useThemed(createStyles)
  const expanded = ariaExpanded === true || accessibilityState?.expanded === true
  return (
    <Tap {...rest} disabled={disabled} aria-expanded={expanded} aria-disabled={Boolean(disabled)} style={[styles.trigger, expanded && styles.triggerOpen, Boolean(disabled) && styles.disabled, style]}>
      {icon}
      <Copy style={styles.triggerLabel}>{children}</Copy>
    </Tap>
  )
}

export type PopoverOpener = { onPress?: () => void; accessibilityState?: AccessibilityState; 'aria-expanded'?: boolean }

export type PopoverProps = {
  /** The element that opens it: PopoverTrigger, Button or anything that takes `onPress`. */
  trigger: ReactElement<PopoverOpener>
  /** Bold first line. */
  title?: ReactNode
  description?: ReactNode
  /** The panel's spoken name when there is no `title`. */
  label?: string
  children?: ReactNode
  /** Actions at the bottom of the card. */
  footer?: ReactNode
  /** Flips when there is no room. Default `bottom`. */
  side?: Side
  /** Which edges line up. Default `center`. */
  align?: Align
  /** Panel width on tablets, 280 to 300 in the spec. Phones use 320. Default `280`. */
  width?: number
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** `false` turns off the open and close motion. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const MOTION: FloatingMotion = { from: { opacity: 0, scale: 0.96, shift: 6 }, exitScale: 0.98, open: OPEN, close: CLOSE }

/** Anchored context with a nub. Stays open until a tap outside, the back button or the trigger again. */
export function Popover({ trigger, title, description, label, children, footer, side = 'bottom', align = 'center', width = 280, open: controlled, defaultOpen = false, onOpenChange, animated = true, style }: PopoverProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const compact = useCompact()
  const anchor = useRef<ViewInstance>(null)
  const [inner, setInner] = useState(defaultOpen)
  const open = controlled ?? inner

  function set(next: boolean): void {
    setInner(next)
    onOpenChange?.(next)
  }

  const opener = cloneElement(trigger, {
    accessibilityState: { ...trigger.props.accessibilityState, expanded: open },
    'aria-expanded': open,
    onPress: () => { trigger.props.onPress?.(); set(!open) },
  })

  return (
    <>
      <View ref={anchor} collapsable={false} style={styles.anchor}>{opener}</View>
      <Floating anchor={anchor} open={open} side={side} align={align} offset={OFFSET} width={compact ? PHONE_PANEL : width} motion={MOTION} animated={animated} onDismiss={() => set(false)}>
        {(placed) => (
          <View accessibilityLabel={label} style={[styles.panel, style]}>
            <View style={styles.body}>
              {title ? <Copy style={styles.title}>{title}</Copy> : null}
              {description ? <Copy style={styles.description}>{description}</Copy> : null}
              {children ? <View style={title || description ? styles.gap : null}>{children}</View> : null}
              {footer ? <View style={styles.footer}>{footer}</View> : null}
            </View>
            <Nub placed={placed} fill={colors.muted} />
          </View>
        )}
      </Floating>
    </>
  )
}

const layer = StyleSheet.create({
  floating: { position: 'absolute' },
  nub: { position: 'absolute', width: 16, height: 8 },
})

const createStyles = (c: Colors) => StyleSheet.create({
  anchor: { alignSelf: 'flex-start' },
  trigger: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', gap: space[1.5], minHeight: 44, paddingLeft: space[3.5], paddingRight: space[4] },
  triggerOpen: { ...soft(c), borderColor: c.ink10 },
  triggerLabel: { ...type(15, c.textPrimary, '500'), lineHeight: 20 },
  disabled: { opacity: 0.4 },
  panel: { ...soft(c), backgroundColor: c.muted, borderRadius: radius.tray, padding: space[1] },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, padding: space[4] },
  title: { ...type(15, c.textPrimary, '600'), lineHeight: 20 },
  description: { ...type(13, c.textSecondary), lineHeight: 18, marginTop: space[0.5] },
  gap: { marginTop: space[3] },
  footer: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', marginTop: space[3] },
})
