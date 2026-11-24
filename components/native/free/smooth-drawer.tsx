import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Extrapolation, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed } from './card'
import { GrabberBar, Modal, useDisclosure, useModal, type DisclosureProps, type DismissReason, type ModalMotion } from './dialog'
import { animateTo, Copy, EASE_IN, EASE_OUT, Mark, soft, Tap, type Transition } from './popover'

/** The 40% black in the spec, as a share of the scrim token. */
const SCRIM = 0.73
const PEEK = 210
const RUBBER = 0.3
const FLICK = 500
const TOP_GAP = 64
const MAX_WIDTH = 390
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
  /** Height at Peek. Default `210`. */
  peekHeight?: number
  showLabel?: string
  hideLabel?: string
  /** Starts at Expanded. */
  defaultExpanded?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A drawer with heights to drag between: Peek shows the essentials, Expanded shows everything. */
export function SmoothDrawer({ title, description, aside, peek, children, peekHeight = PEEK, showLabel = 'Order details', hideLabel = 'Hide details', defaultExpanded = false, animated = true, style, ...disclosure }: SmoothDrawerProps) {
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
  peekHeight: number
  showLabel: string
  hideLabel: string
  defaultExpanded: boolean
  animated: boolean
}

function Sheet({ title, description, aside, peek, children, peekHeight, showLabel, hideLabel, defaultExpanded, animated, style }: SheetProps) {
  const styles = useThemed(createStyles)
  const { open, finish, requestClose } = useModal()
  const still = useStill(animated)
  const view = useWindowDimensions()
  const height = view.height - TOP_GAP
  const sheetWidth = Math.min(MAX_WIDTH, view.width)
  const mid = Math.max(0, height - peekHeight)
  const y = useSharedValue(height)
  const dragStart = useSharedValue(0)
  const dragging = useSharedValue(0)
  const turn = useSharedValue(defaultExpanded ? 180 : 0)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const arrived = useRef(false)

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

  useEffect(() => {
    if (open) {
      if (!arrived.current) { arrived.current = true; move(expanded ? 0 : mid, OPEN) }
      return
    }
    if (still) { finish(); return }
    y.value = animateTo(height, CLOSE, finish)
    // Runs when the panel arrives and when it is told to leave.
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

  const sheet = useAnimatedStyle(() => ({ height, width: sheetWidth, transform: [{ translateY: y.value }] }), [height, sheetWidth])
  const reveal = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [mid - REVEAL, mid], [1, 0], Extrapolation.CLAMP) }), [mid])
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))

  return (
    <Animated.View accessibilityViewIsModal style={[styles.sheet, sheet, style]}>
      <GestureDetector gesture={grabberPan}><View><GrabberBar dragging={dragging} /></View></GestureDetector>
      <GestureDetector gesture={headerPan}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Copy style={styles.title}>{title}</Copy>
            {description ? <Copy style={styles.description}>{description}</Copy> : null}
          </View>
          {aside ? <View style={styles.aside}>{aside}</View> : null}
        </View>
      </GestureDetector>
      <View style={styles.peek}>
        {peek}
        <View style={styles.toggle}>
          <Button variant="ghost" size="sm" aria-expanded={expanded} animated={animated} trailingIcon={<Animated.View style={chevron}><Mark name="chevron-up" /></Animated.View>} onPress={toggle}>
            {expanded ? hideLabel : showLabel}
          </Button>
        </View>
      </View>
      <Animated.View aria-hidden={!expanded} pointerEvents={expanded ? 'auto' : 'none'} style={[styles.details, reveal]}>
        <ScrollView contentContainerStyle={styles.detailsBody}>{children}</ScrollView>
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

/** A choice card inside the drawer. The ring moves to ink when selected. */
export function SmoothOption({ title, meta, price, selected, onSelect, accessibilityLabel, animated = true, style }: SmoothOptionProps) {
  const styles = useThemed(createStyles)
  return (
    <Tap accessibilityRole="radio" accessibilityLabel={accessibilityLabel ?? (typeof title === 'string' ? title : undefined)} aria-selected={selected} aria-checked={selected} animated={animated} onPress={onSelect} style={[styles.option, selected && styles.optionOn, style]}>
      <View style={styles.optionText}>
        <Copy style={styles.optionTitle}>{title}</Copy>
        {meta ? <Copy style={styles.meta}>{meta}</Copy> : null}
      </View>
      {typeof price === 'string' ? <Text style={styles.optionTitle}>{price}</Text> : price}
    </Tap>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  sheet: { ...soft(c), alignSelf: 'center', backgroundColor: c.canvas, borderColor: c.ink8, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderWidth: 1, bottom: 0, gap: space[2], paddingBottom: space[2], paddingHorizontal: space[2], position: 'absolute' },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: space[3], justifyContent: 'space-between', paddingHorizontal: space[2] },
  heading: { flex: 1, minWidth: 0 },
  aside: { alignItems: 'flex-end', flexShrink: 0 },
  title: { ...type(16, c.textPrimary, '600'), lineHeight: 20 },
  description: { ...type(13, c.textSecondary), lineHeight: 18 },
  peek: { gap: space[2] },
  toggle: { alignSelf: 'center' },
  details: { flex: 1, minHeight: 0 },
  detailsBody: { gap: space[2] },
  option: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, flex: 1, flexDirection: 'row', gap: space[3], minHeight: 44, minWidth: 0, paddingHorizontal: space[3], paddingVertical: space[2.5] },
  optionOn: { borderColor: c.textPrimary },
  optionText: { flex: 1, minWidth: 0 },
  optionTitle: { ...type(14, c.textPrimary), lineHeight: 20 },
  meta: { ...type(12, c.textSecondary), lineHeight: 16 },
})
