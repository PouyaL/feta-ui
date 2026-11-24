import { cloneElement, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { KeyboardAvoidingView, Modal as NativeModal, Platform, Pressable, ScrollView, StyleSheet, View, useColorScheme, useWindowDimensions, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, { interpolateColor, runOnJS, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { animateTo, Copy, EASE_IN, EASE_OUT, Mark, ORIENTATIONS, soft, useCompact, type Transition } from './popover'

/** The Figma scrim alpha, `--feta-effect-scrim`. */
const SCRIM_ALPHA = 0.55
/** The 40% black in the spec, as a share of the scrim token. */
const SCRIM = 0.73
const RUBBER = 0.3
const FADE_MS = 150
const DRAG_START = 8
const BACK_SPRING = { stiffness: 500, damping: 40 }
const GRABBER_MS = 100

const SCRIM_IN = { duration: 200, easing: EASE_OUT }
const SCRIM_OUT = { duration: 160, easing: EASE_IN }
const OPEN = { duration: 200, easing: EASE_OUT }
const CLOSE = { duration: 150, easing: EASE_IN }
const SHEET_OPEN = { duration: 280, dampingRatio: 0.8 }
const SHEET_CLOSE = { duration: 220, easing: EASE_IN }
const SHEET_DRAG = { closeAt: 0.3, velocity: 600 }

export type ModalPlacement = 'center' | 'bottom' | 'top' | 'left' | 'right'
/** `escape` is the Android back button. */
export type DismissReason = 'escape' | 'scrim' | 'drag' | 'close'

/** A panel pose. `xShare` and `yShare` are fractions of the panel's own size, so `yShare: 1` is fully off the bottom. */
export type ModalPose = { opacity?: number; scale?: number; x?: number; y?: number; xShare?: number; yShare?: number }
/** Start and end pose of a panel, with its timing. */
export type ModalMotion = { from: ModalPose; exit: ModalPose; open: Transition; close: Transition }

const POSE_WIDE: ModalMotion = { from: { opacity: 0, scale: 0.96, y: 8 }, exit: { opacity: 0, scale: 0.98 }, open: OPEN, close: CLOSE }
const POSE_PHONE: ModalMotion = { from: { yShare: 1 }, exit: { yShare: 1 }, open: SHEET_OPEN, close: SHEET_CLOSE }

type DragRule = { closeAt: number; velocity: number }

type ModalContextValue = {
  mobile: boolean
  still: boolean
  /** False once the panel should leave. */
  open: boolean
  /** Close button and tray actions call this. */
  requestClose: (reason: DismissReason) => void
  locked: boolean
  /** True when the panel can be pulled down. */
  drag: boolean
  /** A panel that owns its motion calls this when it has left. */
  finish: () => void
  dragY: SharedValue<number>
  dragging: SharedValue<number>
  height: SharedValue<number>
  rule: DragRule | false
  endDrag: () => void
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function useModal(): ModalContextValue {
  const value = useContext(ModalContext)
  if (!value) throw new Error('This part must be used inside a modal.')
  return value
}

/** A pan that pulls the panel down. Each detector needs its own, so call this once per drag handle. */
export function useModalDrag(): ReturnType<typeof Gesture.Pan> | null {
  const { dragY, dragging, height, rule, endDrag } = useModal()
  return useMemo(() => {
    if (!rule) return null
    const { closeAt, velocity } = rule
    return Gesture.Pan()
      .activeOffsetY([-DRAG_START, DRAG_START])
      .onStart(() => { dragging.value = 1 })
      .onUpdate((e) => { dragY.value = e.translationY > 0 ? e.translationY : e.translationY * RUBBER })
      .onEnd((e) => {
        if (e.translationY > height.value * closeAt || e.velocityY > velocity) runOnJS(endDrag)()
        else dragY.value = withSpring(0, BACK_SPRING)
      })
      .onFinalize(() => { dragging.value = 0 })
  }, [dragY, dragging, endDrag, height, rule])
}

export type ModalProps = {
  open: boolean
  /** The person tried to leave. Decide here, and set `open` to false to close. */
  onDismiss: (reason: DismissReason) => void
  role?: 'dialog' | 'alertdialog'
  /** Spoken name of the panel. */
  label?: string
  placement?: ModalPlacement
  /** Where the panel sits on phones. Default `bottom` for anything that drags. */
  mobilePlacement?: ModalPlacement
  /** Share of `--feta-effect-scrim`, 0 to 1. */
  scrim?: number
  /** Lets the page dim first, in ms. */
  panelDelay?: number
  /** Picks the panel's pose, once the platform is known. */
  pose: (mobile: boolean) => ModalMotion
  /** Pull the panel down to close. Fractions of its height, and px/s. */
  drag?: DragRule | false
  /** Replaces the default panel, for a sheet that owns its own heights. */
  renderPanel?: (context: ModalContextValue) => ReactNode
  locked?: boolean
  animated?: boolean
  /** Panel width. Default `440`. Phone sheets fill the screen. */
  width?: number
  /** Space around the panel. Default `8`, and `0` on a docked phone sheet. */
  inset?: 0 | 8
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

const distance = (pose: ModalPose, size: { width: number; height: number }): { x: number; y: number } => ({
  x: pose.x ?? (pose.xShare ?? 0) * size.width,
  y: pose.y ?? (pose.yShare ?? 0) * size.height,
})

/** The layer under Dialog, Alert Dialog, Sheet and Drawer: a native Modal, so the page behind is out of reach and out of the accessibility tree. */
export function Modal({ open, onDismiss, role = 'dialog', label, placement = 'center', mobilePlacement, scrim = 1, panelDelay = 0, pose, drag = false, renderPanel, locked = false, animated = true, width = 440, inset, style, children }: ModalProps) {
  const still = useStill(animated)
  const fades = animated && still
  const scheme = useColorScheme()
  const styles = useThemed(createStyles)
  const view = useWindowDimensions()
  const mobile = useCompact()
  const [present, setPresent] = useState(open)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const entered = useRef(false)
  const opened = useRef(open)
  const dismiss = useRef(onDismiss)
  const scrimOpacity = useSharedValue(0)
  const opacity = useSharedValue(0)
  const scale = useSharedValue(1)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const dragY = useSharedValue(0)
  const dragging = useSharedValue(0)
  const height = useSharedValue(0)
  if (open && !present) setPresent(true)
  useEffect(() => { dismiss.current = onDismiss; opened.current = open })

  const motion = pose(mobile)
  const rule = drag && mobile ? drag : false
  const docked = mobile && Boolean(drag)
  const where = docked ? mobilePlacement ?? 'bottom' : placement
  const gutter = inset ?? (docked && where === 'bottom' ? 0 : 8)
  const across = where === 'top' || where === 'bottom'
  const full = docked && across && gutter === 0
  const panelWidth = Math.min(width, view.width - gutter * 2)
  const panelHeight = view.height - (full ? 32 : 16)

  function finish(): void {
    entered.current = false
    setPresent(false)
    setSize(null)
    dragY.value = 0
    opacity.value = 0
    scrimOpacity.value = 0
  }

  // A pull past the line stays where it is while the panel leaves. If the owner refuses, it springs back.
  function endDrag(): void {
    dismiss.current('drag')
    requestAnimationFrame(() => { if (opened.current) dragY.value = withSpring(0, BACK_SPRING) })
  }

  useEffect(() => {
    if (!present || !open) return
    scrimOpacity.value = withTiming(scrim * SCRIM_ALPHA, { duration: still ? 0 : SCRIM_IN.duration, easing: SCRIM_IN.easing })
  }, [open, present, scrim, scrimOpacity, still])

  useEffect(() => {
    if (!open || !present || (!size && !renderPanel) || entered.current) return
    entered.current = true
    if (renderPanel) return
    if (still) {
      x.value = 0
      y.value = 0
      scale.value = 1
      opacity.value = fades ? 0 : 1
      if (fades) opacity.value = withTiming(1, { duration: FADE_MS })
      return
    }
    const start = distance(motion.from, size ?? { width: 0, height: 0 })
    opacity.value = motion.from.opacity ?? 1
    scale.value = motion.from.scale ?? 1
    x.value = start.x
    y.value = start.y
    const go = (): void => {
      opacity.value = animateTo(1, motion.open)
      scale.value = animateTo(1, motion.open)
      x.value = animateTo(0, motion.open)
      y.value = animateTo(0, motion.open)
    }
    if (panelDelay) {
      const timer = setTimeout(go, panelDelay)
      return () => clearTimeout(timer)
    }
    go()
    return undefined
    // The pose is read once, when the panel arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, present, size, still])

  useEffect(() => {
    if (open || !present) return
    scrimOpacity.value = withTiming(0, { duration: still && !fades ? 0 : SCRIM_OUT.duration, easing: SCRIM_OUT.easing })
    if (renderPanel) return
    if (!entered.current || (still && !fades)) { finish(); return }
    if (still) { opacity.value = animateTo(0, { duration: FADE_MS }, finish); return }
    const end = distance(motion.exit, size ?? { width: 0, height: 0 })
    if (motion.exit.opacity === undefined) y.value = animateTo(end.y, motion.close, finish)
    else {
      opacity.value = animateTo(motion.exit.opacity, motion.close, finish)
      y.value = animateTo(end.y, motion.close)
    }
    x.value = animateTo(end.x, motion.close)
    if (motion.exit.scale !== undefined) scale.value = animateTo(motion.exit.scale, motion.close)
    // Exit runs once, from whatever pose the panel is in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, present])

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }))
  const panel = useAnimatedStyle(() => ({
    opacity: opacity.value,
    width: full ? '100%' : panelWidth,
    maxHeight: panelHeight,
    transform: [{ translateX: x.value }, { translateY: y.value + dragY.value }, { scale: scale.value }],
  }), [full, panelHeight, panelWidth])

  function onLayout(e: LayoutChangeEvent): void {
    const box = e.nativeEvent.layout
    height.value = box.height
    setSize((held) => held ?? { width: box.width, height: box.height })
  }

  const context: ModalContextValue = {
    mobile,
    still,
    open,
    requestClose: (reason) => dismiss.current(reason),
    locked,
    drag: Boolean(rule),
    finish,
    dragY,
    dragging,
    height,
    rule,
    endDrag,
  }

  return (
    <NativeModal transparent statusBarTranslucent navigationBarTranslucent visible={present} animationType="none" supportedOrientations={[...ORIENTATIONS]} onRequestClose={() => dismiss.current('escape')}>
      {/* Gestures inside a native Modal need a root of their own on Android. */}
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <ModalContext.Provider value={context}>
          <Animated.View style={[styles.scrim, scheme === 'dark' ? styles.scrimDark : null, scrimStyle]} />
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" style={StyleSheet.absoluteFill} onPress={() => dismiss.current('scrim')} />
          {renderPanel ? renderPanel(context) : (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={[StyleSheet.absoluteFill, PLACE[where], gutter === 8 ? layout.gutter : null]}>
              <Animated.View
                accessibilityViewIsModal
                accessibilityRole={role === 'alertdialog' ? 'alert' : undefined}
                accessibilityLabel={label}
                onLayout={onLayout}
                style={[layout.panel, panel, style]}
              >
                {children}
              </Animated.View>
            </KeyboardAvoidingView>
          )}
        </ModalContext.Provider>
      </GestureHandlerRootView>
    </NativeModal>
  )
}

export type ModalGrabberProps = { style?: StyleProp<ViewStyle> }

/** The top bar on a bottom sheet. Decorative: every sheet also has a visible way out. */
export function ModalGrabber({ style }: ModalGrabberProps) {
  const { dragging } = useModal()
  const gesture = useModalDrag()
  const body = <GrabberBar dragging={dragging} style={style} />
  return gesture ? <GestureDetector gesture={gesture}><View>{body}</View></GestureDetector> : body
}

/** The bar alone, for a sheet that owns its pan. */
export function GrabberBar({ dragging, style }: { dragging: SharedValue<number>; style?: StyleProp<ViewStyle> }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const wash = colors.ink10
  const solid = colors.textTertiary
  const held = useDerivedValue(() => withTiming(dragging.value, { duration: GRABBER_MS }))
  const bar = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(held.value, [0, 1], [wash, solid]),
    transform: [{ scaleX: 1 + held.value * 0.33 }],
  }), [solid, wash])
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.grabber, style]}>
      <Animated.View style={[styles.bar, bar]} />
    </View>
  )
}

type Opener = { onPress?: () => void; 'aria-expanded'?: boolean }

export type DisclosureProps = {
  /** The element that opens it. Anything that takes `onPress`. */
  trigger?: ReactElement<Opener> | undefined
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean) => void) | undefined
}

/** Controlled or not, with the trigger wired up. */
export function useDisclosure({ trigger, open: controlled, defaultOpen = false, onOpenChange }: DisclosureProps) {
  const [inner, setInner] = useState(defaultOpen)
  const open = controlled ?? inner
  function set(next: boolean): void {
    setInner(next)
    onOpenChange?.(next)
  }
  const opener = trigger ? cloneElement(trigger, {
    'aria-expanded': open,
    onPress: () => { trigger.props.onPress?.(); set(true) },
  }) : null
  return { open, set, opener }
}

export type DialogHeaderProps = {
  title: ReactNode
  description?: ReactNode
  /** A 40 px tile on 5% ink, usually an icon. */
  media?: ReactNode
  /** `false` leaves the back button and a scrim tap as the way out. */
  close?: boolean
  style?: StyleProp<ViewStyle>
}

/** Title, description, optional media and the close button. */
export function DialogHeader({ title, description, media, close = true, style }: DialogHeaderProps) {
  const styles = useThemed(createStyles)
  const { requestClose, locked, still } = useModal()
  return (
    <View style={[styles.header, style]}>
      {media ? <View style={styles.media}>{media}</View> : null}
      <View style={styles.heading}>
        <Copy style={styles.title}>{title}</Copy>
        {description ? <Copy style={styles.description}>{description}</Copy> : null}
      </View>
      {close ? <IconButton variant="secondary" size="sm" label="Close" animated={!still} disabled={locked} icon={<Mark name="x" />} onPress={() => requestClose('close')} /> : null}
    </View>
  )
}

export type DialogFooterProps = {
  /** A line of context above the actions. */
  note?: ReactNode
  /** Primary last. Phones stack them with the primary first. */
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/** Actions on the tray, under the inset card. */
export function DialogFooter({ note, children, style }: DialogFooterProps) {
  const styles = useThemed(createStyles)
  const { mobile } = useModal()
  return (
    <View style={[styles.footer, style]}>
      {note ? <Copy style={styles.note}>{note}</Copy> : null}
      <View style={[styles.actions, mobile && styles.actionsStacked]}>{children}</View>
    </View>
  )
}

export type DialogProps = DisclosureProps & {
  title: ReactNode
  description?: ReactNode
  media?: ReactNode
  /** `false` hides the close button. */
  close?: boolean
  /** A DialogFooter. */
  footer?: ReactElement | undefined
  /** Both pin the header with a hairline and scroll the card. `sticky` is for tray actions, `scroll` for none. */
  layout?: 'default' | 'sticky' | 'scroll'
  /** Locks close, the back button and the scrim. Set the primary's `status` to `loading` too. */
  submitting?: boolean
  /** `false` turns off every panel motion. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

/** A window over the page for one focused task. On phones the same dialog is a bottom sheet. */
export function Dialog({ title, description, media, close = true, footer, layout: arrangement = 'default', submitting = false, animated = true, style, children, ...disclosure }: DialogProps) {
  const { open, set, opener } = useDisclosure(disclosure)
  const still = useStill(animated)
  const pulse = useSharedValue(1)

  function dismiss(_: DismissReason): void {
    if (!submitting) { set(false); return }
    if (still) return
    pulse.value = withSequence(withTiming(1.02, { duration: 70 }), withSpring(1, { duration: 200, dampingRatio: 0.6 }))
  }


  return (
    <>
      {opener}
      <Modal open={open} onDismiss={dismiss} scrim={SCRIM} pose={(mobile) => (mobile ? POSE_PHONE : POSE_WIDE)} drag={SHEET_DRAG} locked={submitting} animated={animated}>
        <DialogBody pulse={pulse} arrangement={arrangement} title={title} description={description} media={media} close={close} footer={footer} style={style}>{children}</DialogBody>
      </Modal>
    </>
  )
}

type BodyProps = Pick<DialogProps, 'title' | 'description' | 'media' | 'close' | 'footer' | 'style' | 'children'> & { pulse: SharedValue<number>; arrangement: NonNullable<DialogProps['layout']> }

function DialogBody({ pulse, arrangement, title, description, media, close, footer, style, children }: BodyProps) {
  const styles = useThemed(createStyles)
  const { mobile } = useModal()
  const pinned = arrangement !== 'default'
  const nudge = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }))
  const header = <DialogHeader title={title} description={description} media={media} {...(close === undefined ? {} : { close })} {...(pinned ? { style: styles.headerPinned } : {})} />
  return (
    <Animated.View style={[styles.tray, mobile && styles.traySheet, pinned && styles.trayPinned, nudge, style]}>
      {mobile ? <ModalGrabber /> : null}
      <View style={[styles.card, pinned && styles.cardPinned]}>
        {header}
        {pinned ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroller}>{children}</ScrollView> : children}
      </View>
      {footer ?? null}
    </Animated.View>
  )
}

const PLACE = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  bottom: { alignItems: 'center', justifyContent: 'flex-end' },
  top: { alignItems: 'center', justifyContent: 'flex-start' },
  left: { flexDirection: 'row', justifyContent: 'flex-start' },
  right: { flexDirection: 'row', justifyContent: 'flex-end' },
})

const layout = StyleSheet.create({
  gutter: { padding: space[2] },
  panel: { flexShrink: 1 },
})

const createStyles = (c: Colors) => StyleSheet.create({
  // kit.ts has no scrim color yet. Inverse is the near black in Light, and Canvas is in Dark.
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: c.inverse },
  scrimDark: { backgroundColor: c.canvas },
  grabber: { alignItems: 'center', minHeight: 24, paddingBottom: space[1], paddingTop: space[0.5] },
  bar: { borderRadius: radius.full, height: 4, width: 36 },
  tray: { backgroundColor: c.muted, borderRadius: radius.tray, flexShrink: 1, padding: space[1] },
  traySheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: space[7] },
  trayPinned: { maxHeight: 420 },
  card: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, flexShrink: 1, gap: space[4], padding: space[5] },
  cardPinned: { overflow: 'hidden', paddingBottom: 0 },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: space[3] },
  headerPinned: { borderBottomColor: c.ink8, borderBottomWidth: 1, marginBottom: -space[4], paddingBottom: space[4] },
  scroller: { gap: space[4], paddingBottom: space[5], paddingTop: space[4] },
  media: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.control, height: 40, justifyContent: 'center', width: 40 },
  heading: { flex: 1, minWidth: 0 },
  title: { ...type(18, c.textPrimary, '600'), lineHeight: 24 },
  description: { ...type(14, c.textSecondary), lineHeight: 20, marginTop: space[1] },
  footer: { gap: space[2], paddingBottom: space[2], paddingHorizontal: space[3], paddingTop: space[3] },
  note: { ...type(13, c.textSecondary), lineHeight: 18 },
  actions: { flexDirection: 'row', gap: space[2], justifyContent: 'flex-end' },
  actionsStacked: { flexDirection: 'column-reverse' },
})
