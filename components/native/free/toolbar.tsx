import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type ViewInstance, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeOut, LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { pressedState, radius, space, useColors, type Colors } from '../kit'
import { withInk } from './button'
import { type, useStill, useThemed } from './card'
import { Kbd } from './kbd'
import { Floating, soft, Tap, useCompact, type FloatingMotion, type Side } from './popover'
import { Tooltip } from './tooltip'

const REDOCK = { stiffness: 380, damping: 32 }
const JUMP = { stiffness: 500, damping: 34 }
const FLYOUT_MS = 160
const ZONE_MS = 160
const LONG_PRESS_MS = 400
const TOOL = 40
const TOOL_REACH = 2
const INSET = 16
const FLYOUT_WIDTH = { phone: 220, tablet: 200 }
const FLYOUT_GAP = 8
const GRIP_REACH = 12

const DOCK_MOVE = LinearTransition.springify().stiffness(REDOCK.stiffness).damping(REDOCK.damping)
const ZONE_IN = FadeIn.duration(ZONE_MS)
const ZONE_OUT = FadeOut.duration(ZONE_MS)
const MOTION: FloatingMotion = { from: { opacity: 0, scale: 0.96 }, open: { duration: FLYOUT_MS }, close: { duration: FLYOUT_MS / 2 } }

export type ToolOption = { id: string; label: string; icon: ReactNode; shortcut?: string }
export type Tool = { id: string; label: string; icon: ReactNode; shortcut?: string; /** A flyout on long press: the last chosen becomes the slot's icon. */ options?: ToolOption[] }
export type ToolbarEntry = Tool | { divider: true }
export type DockEdge = 'bottom' | 'left' | 'right' | 'top'

export type ToolbarProps = {
  tools: ToolbarEntry[]
  value?: string
  defaultValue?: string
  onValueChange?: (id: string) => void
  dock?: DockEdge
  defaultDock?: DockEdge
  onDockChange?: (edge: DockEdge) => void
  label?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const isTool = (entry: ToolbarEntry): entry is Tool => 'id' in entry
const EDGES: DockEdge[] = ['bottom', 'left', 'right', 'top']
const FACING: Record<DockEdge, Side> = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' }

/** A floating tool dock for canvas apps. Place it in a canvas that fills a positioned View: it holds the current tool on an ink plate, and on tablets its grip redocks it to any edge. */
export function Toolbar({ tools, value, defaultValue, onValueChange, dock, defaultDock = 'bottom', onDockChange, label = 'Tools', animated = true, style }: ToolbarProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const compact = useCompact()
  const list = tools.filter(isTool)
  const [held, setHeld] = useState(defaultValue ?? list[0]?.id)
  const [heldDock, setHeldDock] = useState(defaultDock)
  const [slots, setSlots] = useState<Record<string, string>>({})
  const [flyout, setFlyout] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const current = value ?? held
  const edge = dock ?? heldDock
  const vertical = edge === 'left' || edge === 'right'
  const anchor = useRef<ViewInstance | null>(null)
  const nodes = useRef<Record<string, ViewInstance | null>>({})
  const boxes = useRef<Record<string, { x: number; y: number }>>({})
  const canvas = useRef({ width: 0, height: 0 })
  const frame = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const last = useRef<Tool | undefined>(undefined)
  const placed = useRef(false)
  const plateX = useSharedValue(0)
  const plateY = useSharedValue(0)
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  const open = list.find((tool) => tool.id === flyout)
  if (open) last.current = open
  const shownFlyout = last.current

  function choose(id: string): void {
    setHeld(id)
    onValueChange?.(id)
  }

  function place(id: string | undefined): void {
    const box = id === undefined ? undefined : boxes.current[id]
    if (!box) return
    const glides = !still && placed.current
    plateX.value = glides ? withSpring(box.x, JUMP) : box.x
    plateY.value = glides ? withSpring(box.y, JUMP) : box.y
    placed.current = true
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => place(current), [current])

  const measure = (id: string) => (e: LayoutChangeEvent): void => {
    const { x, y } = e.nativeEvent.layout
    boxes.current[id] = { x, y }
    if (id === current) place(id)
  }

  function openFlyout(id: string): void {
    anchor.current = nodes.current[id] ?? null
    setFlyout(id)
  }

  function land(x: number, y: number): void {
    setDragging(false)
    const { width, height } = canvas.current
    const distances: Record<DockEdge, number> = { bottom: height - y, top: y, left: x, right: width - x }
    const nearest = EDGES.reduce((best, item) => (distances[item] < distances[best] ? item : best), edge)
    setHeldDock(nearest)
    onDockChange?.(nearest)
  }

  const startDrag = (): void => setDragging(true)
  const landFromDrag = (x: number, y: number): void => land(frame.current.x + frame.current.width / 2 + x, frame.current.y + frame.current.height / 2 + y)

  const grip = useMemo(() => Gesture.Pan()
    .onStart(() => { runOnJS(startDrag)() })
    .onUpdate((e) => {
      dragX.value = e.translationX
      dragY.value = e.translationY
    })
    .onEnd((e) => {
      runOnJS(landFromDrag)(e.translationX, e.translationY)
      dragX.value = withSpring(0, REDOCK)
      dragY.value = withSpring(0, REDOCK)
    }),
  // The handlers read refs and the current edge, which is listed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [dragX, dragY, edge])

  const dragged = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }, { translateY: dragY.value }] }))
  const plate = useAnimatedStyle(() => ({ transform: [{ translateX: plateX.value }, { translateY: plateY.value }] }))
  const slotIcon = (tool: Tool): ReactNode => tool.options?.find((item) => item.id === slots[tool.id])?.icon ?? tool.icon

  const toolButton = (entry: Tool): ReactNode => {
    const on = entry.id === current
    const button = (
      <Tap
        accessibilityLabel={entry.label}
        accessibilityHint={entry.options ? 'Long press for more' : undefined}
        {...pressedState(on)}
        {...(entry.options ? { 'aria-expanded': flyout === entry.id } : {})}
        animated={animated}
        delayLongPress={LONG_PRESS_MS}
        hitSlop={TOOL_REACH}
        onLongPress={entry.options ? () => openFlyout(entry.id) : undefined}
        onPress={() => choose(entry.id)}
        style={styles.tool}
      >
        {withInk(slotIcon(entry), on ? colors.textInverse : colors.textSecondary)}
        {entry.options ? <View style={[styles.caret, on && styles.caretOn]} /> : null}
      </Tap>
    )
    return entry.options ? button : <Tooltip content={entry.label} side={FACING[edge]} {...(entry.shortcut ? { shortcut: [entry.shortcut] } : {})} animated={animated} disabled={dragging || flyout !== null}>{button}</Tooltip>
  }

  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => { const { width, height } = e.nativeEvent.layout; canvas.current = { width, height } }}
      style={[StyleSheet.absoluteFill, layout[edge]]}
    >
      {dragging ? EDGES.filter((item) => item !== edge).map((item) => <Animated.View key={item} {...(still ? {} : { entering: ZONE_IN, exiting: ZONE_OUT })} pointerEvents="none" style={[styles.zone, zones[item]]} />) : null}
      <Animated.View
        {...(still ? {} : { layout: DOCK_MOVE })}
        accessibilityRole="toolbar"
        accessibilityLabel={label}
        onLayout={(e: LayoutChangeEvent) => { frame.current = e.nativeEvent.layout }}
        style={[styles.dock, vertical && styles.dockVertical, dragged, style]}
      >
        {list.some((tool) => tool.id === current) ? <Animated.View pointerEvents="none" style={[styles.plate, plate]} /> : null}
        {compact ? null : (
          <GestureDetector gesture={grip}>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" hitSlop={GRIP_REACH} style={[styles.grip, vertical && styles.gripVertical]}>
              {[0, 1, 2, 3, 4, 5].map((dot) => <View key={dot} style={styles.gripDot} />)}
            </View>
          </GestureDetector>
        )}
        {tools.map((entry, i) => {
          if (!isTool(entry)) return <View key={i} accessibilityElementsHidden style={[styles.divider, vertical && styles.dividerVertical]} />
          return (
            <View
              key={entry.id}
              ref={(node) => { nodes.current[entry.id] = node }}
              collapsable={false}
              onLayout={measure(entry.id)}
            >
              {toolButton(entry)}
            </View>
          )
        })}
      </Animated.View>
      <Floating anchor={anchor} anchorKey={flyout ?? undefined} open={open !== undefined} side={FACING[edge]} offset={FLYOUT_GAP} width={compact ? FLYOUT_WIDTH.phone : FLYOUT_WIDTH.tablet} motion={MOTION} animated={animated} onDismiss={() => setFlyout(null)}>
        {() => (
          <View accessibilityRole="menu" accessibilityLabel={shownFlyout?.label} style={styles.flyout}>
            {shownFlyout?.options?.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="menuitem"
                accessibilityLabel={option.label}
                onPress={() => { setSlots({ ...slots, [shownFlyout.id]: option.id }); choose(shownFlyout.id); setFlyout(null) }}
                style={styles.option}
              >
                {option.icon}
                <Text numberOfLines={1} style={styles.optionLabel}>{option.label}</Text>
                {option.shortcut && !compact ? <Kbd size="sm">{option.shortcut}</Kbd> : null}
              </Pressable>
            ))}
          </View>
        )}
      </Floating>
    </View>
  )
}

const layout = StyleSheet.create({
  bottom: { alignItems: 'center', justifyContent: 'flex-end', padding: INSET },
  top: { alignItems: 'center', justifyContent: 'flex-start', padding: INSET },
  left: { alignItems: 'flex-start', justifyContent: 'center', padding: INSET },
  right: { alignItems: 'flex-end', justifyContent: 'center', padding: INSET },
})

const zones = StyleSheet.create({
  bottom: { bottom: INSET, height: 40, left: '20%', right: '20%' },
  top: { height: 40, left: '20%', right: '20%', top: INSET },
  left: { bottom: '20%', left: INSET, top: '20%', width: 40 },
  right: { bottom: '20%', right: INSET, top: '20%', width: 40 },
})

const createStyles = (c: Colors) => StyleSheet.create({
  dock: { ...soft(c), alignItems: 'center', backgroundColor: c.muted, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', gap: space[0.5], padding: space[1] },
  dockVertical: { flexDirection: 'column' },
  zone: { backgroundColor: c.ink4, borderRadius: radius.full, position: 'absolute' },
  plate: { backgroundColor: c.inverse, borderRadius: radius.full, height: TOOL, left: 0, position: 'absolute', top: 0, width: TOOL },
  // Six 3 px dots on a 6 px pitch, two columns of three, as Figma's Grip > Dots; 4 px from the first tool.
  grip: { alignContent: 'center', flexDirection: 'row', flexWrap: 'wrap', columnGap: 3, rowGap: 3, height: 32, justifyContent: 'center', marginLeft: space[1], marginRight: space[0.5], paddingHorizontal: 2.5, width: 14 },
  gripVertical: { height: 14, marginLeft: 0, marginRight: 0, marginTop: space[1], marginBottom: space[0.5], paddingHorizontal: 0, paddingVertical: 2.5, width: 32 },
  gripDot: { backgroundColor: c.textTertiary, borderRadius: radius.full, height: 3, width: 3 },
  divider: { backgroundColor: c.ink8, height: 20, marginHorizontal: space[1], width: 1 },
  dividerVertical: { height: 1, marginHorizontal: 0, marginVertical: space[1], width: 20 },
  tool: { alignItems: 'center', borderRadius: radius.full, height: TOOL, justifyContent: 'center', width: TOOL },
  caret: { borderBottomColor: c.textSecondary, borderBottomWidth: 4, borderLeftColor: 'transparent', borderLeftWidth: 4, bottom: 6, height: 0, position: 'absolute', right: 6, width: 0 },
  caretOn: { borderBottomColor: c.textInverse },
  flyout: { ...soft(c), backgroundColor: c.muted, borderColor: c.ink8, borderRadius: radius['2xl'], borderWidth: 1, padding: space[1] },
  option: { alignItems: 'center', borderRadius: radius.xl, flexDirection: 'row', gap: space[2], height: 44, paddingHorizontal: space[2.5] },
  optionLabel: { ...type(14, c.textPrimary), flex: 1, lineHeight: 20 },
})
