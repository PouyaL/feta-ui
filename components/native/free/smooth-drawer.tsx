import { cloneElement, isValidElement, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed } from './card'
import { GrabberBar, Modal, useDisclosure, useEdgeInsets, useModal, type DisclosureProps, type DismissReason, type ModalMotion } from './dialog'
import { animateTo, Copy, EASE_IN, EASE_OUT, Mark, Tap, type Transition } from './popover'

/** The 40% black in the spec, as a share of the scrim token. */
const SCRIM = 0.73
/** Space under the Toggle row at Peek, from the frames. */
const PEEK_BOTTOM = 18
const RUBBER = 0.3
const FLICK = 500
/** Expanded hugs its content up to this far from the top, the web's --expanded-gap. */
const TOP_GAP = 48
const MAX_WIDTH = 390
/** 8 in from each side, like the web's `width minus 16` on Mobile. */
const SIDE = 8
/** Docked 2 past the bottom so the bottom stroke never shows. */
const SINK = 2
const DRAG_START = 8
const OPEN = { duration: 300, dampingRatio: 0.8 }
const SNAP = { duration: 350, dampingRatio: 0.75 }
/** Pixels above Peek over which the details fade in. */
const REVEAL = 80
const TOGGLE = { duration: 280, easing: EASE_OUT }
const CLOSE = { duration: 220, easing: EASE_IN }

const UNUSED_POSE: ModalMotion = { from: {}, exit: {}, open: OPEN, close: CLOSE }

export type SmoothDrawerProps = DisclosureProps & {
  /** The summary line, like Order summary. */
  title: ReactNode
  description?: ReactNode
  /** Right of the title, like the total. */
  aside?: ReactNode
  /** Shown at Peek under the title: the main action. */
  peek: ReactNode
  /** Revealed at Expanded. */
  children: ReactNode
  /** Height at Peek. Default: measured, so Peek ends 18 under the Order details toggle. */
  peekHeight?: number
  showLabel?: string
  hideLabel?: string
  /** Starts at Expanded. */
  defaultExpanded?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A drawer with heights to drag between: Peek shows the essentials, Expanded shows everything. */
export function SmoothDrawer({ title, description, aside, peek, children, peekHeight, showLabel = 'Order details', hideLabel = 'Hide details', defaultExpanded = false, animated = true, style, ...disclosure }: SmoothDrawerProps) {
  const { open, set, opener } = useDisclosure(disclosure)
  const dismiss = (_: DismissReason): void => set(false)
  return (
    <>
      {opener}
      <Modal
        open={open}
        onDismiss={dismiss}
        placement="bottom"
        scrim={SCRIM}
        pose={() => UNUSED_POSE}
        animated={animated}
        renderPanel={() => <Sheet {...{ title, description, aside, peek, peekHeight, showLabel, hideLabel, defaultExpanded, animated, style }}>{children}</Sheet>}
      />
    </>
  )
}

type SheetProps = Pick<SmoothDrawerProps, 'title' | 'description' | 'aside' | 'peek' | 'children' | 'style'> & {
  peekHeight: number | undefined
  showLabel: string
  hideLabel: string
  defaultExpanded: boolean
  animated: boolean
}

function Sheet({ title, description, aside, peek, children, peekHeight: fixedPeek, showLabel, hideLabel, defaultExpanded, animated, style }: SheetProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const { open, finish, requestClose } = useModal()
  const insets = useEdgeInsets()
  const still = useStill(animated)
  const view = useWindowDimensions()
  const maxHeight = view.height - TOP_GAP - insets.top
  const sheetWidth = Math.min(MAX_WIDTH, view.width) - SIDE * 2
  // Heights from the layout, like the web: the whole sheet hugs its content, and Peek ends 18 under the toggle.
  const [height, setHeight] = useState(0)
  const [toggleBottom, setToggleBottom] = useState(0)
  // Peek clears the home indicator too: the sheet sinks SINK past the screen edge, so add that and the bottom inset.
  const peekHeight = Math.min(height, fixedPeek ?? toggleBottom + PEEK_BOTTOM + insets.bottom + SINK)
  const mid = Math.max(0, height - peekHeight)
  const y = useSharedValue(view.height)
  const dragStart = useSharedValue(0)
  const dragging = useSharedValue(0)
  const turn = useSharedValue(defaultExpanded ? 180 : 0)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const arrived = useRef(false)
  const expandedNow = useRef(expanded)
  useEffect(() => { expandedNow.current = expanded })

  function move(to: number, transition: Transition): void {
    y.value = still ? to : animateTo(to, transition)
  }

  function land(toExpanded: boolean): void {
    setExpanded(toExpanded)
    move(toExpanded ? 0 : mid, SNAP)
    turn.value = withTiming(toExpanded ? 180 : 0, { duration: still ? 0 : TOGGLE.duration, easing: TOGGLE.easing })
  }

  function toggle(): void {
    const next = !expanded
    setExpanded(next)
    move(next ? 0 : mid, TOGGLE)
    turn.value = withTiming(next ? 180 : 0, { duration: still ? 0 : TOGGLE.duration, easing: TOGGLE.easing })
  }

  const drop = (): void => requestClose('drag')

  // Arrives once both heights are known, and keeps the sheet on its stop when content or the screen changes them.
  useEffect(() => {
    if (!open || height === 0 || (fixedPeek === undefined && toggleBottom === 0)) return
    const stop = expandedNow.current ? 0 : mid
    if (!arrived.current) { arrived.current = true; y.value = height; move(stop, OPEN); return }
    if (dragging.value === 0) y.value = stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, height, mid])

  useEffect(() => {
    if (open) return
    if (still) { finish(); return }
    y.value = animateTo(Math.max(height, 1) + SINK, CLOSE, finish)
    // Runs when it is told to leave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pan = (): ReturnType<typeof Gesture.Pan> => Gesture.Pan()
    .activeOffsetY([-DRAG_START, DRAG_START])
    .onStart(() => { dragStart.value = y.value; dragging.value = 1 })
    .onUpdate((e) => {
      const next = dragStart.value + e.translationY
      y.value = next < 0 ? next * RUBBER : Math.min(next, height)
    })
    .onEnd((e) => {
      const here = y.value
      let target = here > mid + peekHeight / 2 ? height : here > mid / 2 ? mid : 0
      if (e.velocityY > FLICK) target = here > mid ? height : mid
      if (e.velocityY < -FLICK) target = here > mid ? mid : 0
      if (target === height) runOnJS(drop)()
      else runOnJS(land)(target === 0)
    })
    .onFinalize(() => { dragging.value = 0 })

  // A detector needs a gesture of its own, so the grabber and the header each get one.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const grabberPan = useMemo(pan, [height, mid, peekHeight, still, expanded])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const headerPan = useMemo(pan, [height, mid, peekHeight, still, expanded])

  const sheet = useAnimatedStyle(() => ({ maxHeight, width: sheetWidth, transform: [{ translateY: y.value }] }), [maxHeight, sheetWidth])
  const reveal = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [mid - REVEAL, mid], [1, 0], Extrapolation.CLAMP) }), [mid])
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))

  return (
    <Animated.View accessibilityViewIsModal onLayout={(e) => setHeight(Math.round(e.nativeEvent.layout.height))} style={[styles.sheet, { paddingBottom: space[4.5] + insets.bottom }, sheet, style]}>
      <GestureDetector gesture={grabberPan}><View><GrabberBar dragging={dragging} style={styles.grabber} /></View></GestureDetector>
      <GestureDetector gesture={headerPan}>
        <View style={styles.summary}>
          <View style={styles.heading}>
            <Copy style={styles.title}>{title}</Copy>
            {description ? <Copy style={styles.description}>{description}</Copy> : null}
          </View>
          {aside ? <View style={styles.aside}>{aside}</View> : null}
        </View>
      </GestureDetector>
      {/* The web stretches the peek action to the sheet's width. */}
      <View style={styles.peek}>{isValidElement<{ style?: StyleProp<ViewStyle> }>(peek) ? cloneElement(peek, { style: [styles.peekFill, peek.props.style] }) : peek}</View>
      <View style={styles.toggleRow} onLayout={(e) => setToggleBottom(Math.round(e.nativeEvent.layout.y + e.nativeEvent.layout.height))}>
        <Button variant="ghost" size="sm" aria-expanded={expanded} animated={animated} style={styles.toggle} trailingIcon={<Animated.View style={chevron}><Mark name="chevron-up" color={colors.textSecondary} /></Animated.View>} onPress={toggle}>
          {expanded ? hideLabel : showLabel}
        </Button>
      </View>
      <Animated.View aria-hidden={!expanded} pointerEvents={expanded ? 'auto' : 'none'} style={[styles.details, reveal]}>
        <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsBody}>{children}</ScrollView>
      </Animated.View>
    </Animated.View>
  )
}

export type SmoothOptionProps = {
  title: ReactNode
  meta?: ReactNode
  price: ReactNode
  selected: boolean
  onSelect: () => void
  /** Spoken name, when `title` is not a string. */
  accessibilityLabel?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A choice card inside the drawer. The ring moves to ink when selected. Cards share a row, like the web's. */
export function SmoothOption({ title, meta, price, selected, onSelect, accessibilityLabel, animated = true, style }: SmoothOptionProps) {
  const styles = useThemed(createStyles)
  return (
    <Tap accessibilityRole="radio" accessibilityLabel={accessibilityLabel ?? (typeof title === 'string' ? title : undefined)} aria-checked={selected} animated={animated} onPress={onSelect} style={[styles.option, selected && styles.optionOn, style]}>
      <View style={styles.optionRow}>
        <Copy style={styles.optionTitle} numberOfLines={1}>{title}</Copy>
        {typeof price === 'string' ? <Text style={styles.optionPrice}>{price}</Text> : price}
      </View>
      {meta ? <Copy style={styles.meta}>{meta}</Copy> : null}
    </Tap>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  sheet: { alignSelf: 'center', backgroundColor: c.canvas, borderColor: c.ink8, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: 1, bottom: -SINK, gap: space[1.5], paddingBottom: space[4.5], paddingHorizontal: space[2.5], position: 'absolute' },
  /** 19 high: 6 above the handle and 8 below. */
  grabber: { minHeight: 19, paddingBottom: space[2], paddingTop: space[1.5] },
  summary: { alignItems: 'flex-end', flexDirection: 'row', gap: space[3], justifyContent: 'space-between', minHeight: 44, paddingHorizontal: space[1.5] },
  heading: { flex: 1, gap: space[0.5], minWidth: 0 },
  aside: { alignItems: 'flex-end', flexShrink: 0 },
  title: { ...type(16, c.textPrimary, '600'), lineHeight: 20 },
  description: { ...type(12, c.textSecondary), lineHeight: 16 },
  // The 12 spacer in the frames sits between two 6 gaps, so 24 from the summary.
  peek: { marginTop: space[4.5] },
  peekFill: { alignSelf: 'stretch' },
  toggleRow: { alignItems: 'center' },
  toggle: { alignSelf: 'center' },
  details: { flexShrink: 1, minHeight: 0 },
  detailsScroll: { flexGrow: 0 },
  detailsBody: { gap: space[3.5], paddingTop: space[1.5] },
  option: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, flex: 1, gap: space[0.5], minWidth: 0, paddingHorizontal: space[3], paddingVertical: space[2.5] },
  optionOn: { borderColor: c.textPrimary, borderWidth: 1.5, paddingHorizontal: space[3] - 0.5, paddingVertical: space[2.5] - 0.5 },
  optionRow: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  optionTitle: { ...type(16, c.textPrimary, '500'), flexShrink: 1, lineHeight: 22 },
  optionPrice: { ...type(12, c.textSecondary, '400', true), lineHeight: 20 },
  meta: { ...type(12, c.textSecondary), lineHeight: 16 },
})
