import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { BentoGripDots, BentoWidget, type BentoWidgetKind, type BentoWidgetProps, type BentoWidgetSize } from './bento-widget'
import { type RenderIcon, useStill, useThemed } from './card'
import { DropdownMenu, type MenuEntry } from './dropdown-menu'

/** Pick up and drop springs, tilt and scale from the 16.5 Motion frame. */
const LIFT_SPRING = { duration: 200, dampingRatio: 0.7 } as const
const DROP_SPRING = { duration: 400, dampingRatio: 0.65 } as const
const LIFT_ROTATE = -3
const LIFT_SCALE = 1.02
const QUIET = { duration: 200, easing: Easing.bezierFn(0.23, 1, 0.32, 1) }
/** A held touch lifts after this, so a tap can still open the Move menu. */
const HOLD_DELAY = 300
/** Three columns from this width, two below it. */
const WIDE_WIDTH = 600
const ROW_HEIGHT = { narrow: 168, wide: 176 } as const
const GUTTER = space[1]
/** The Figma Lifted frame, as a still. */
const PREVIEW = { x: 36, y: -20 }
/** A 28 grip in a 44 target. */
const GRIP_SLOP = 8

export type BentoTile = {
  id: string
  widget: BentoWidgetKind
  /** Small takes one cell, Medium two. */
  size: Extract<BentoWidgetSize, 'small' | 'medium'>
  /** Its size on a phone. Default `size`. */
  mobileSize?: Extract<BentoWidgetSize, 'small' | 'medium'>
  data?: BentoWidgetProps['data']
}

export const BENTO_TILES: BentoTile[] = [
  { id: 'revenue', widget: 'revenue', size: 'small' },
  { id: 'active-users', widget: 'active-users', size: 'medium' },
  { id: 'activity', widget: 'activity', size: 'medium' },
  { id: 'notes', widget: 'notes', size: 'small' },
  { id: 'uptime', widget: 'uptime', size: 'medium', mobileSize: 'small' },
  { id: 'storage', widget: 'storage', size: 'small' },
]

const MOBILE_ORDER = ['revenue', 'storage', 'active-users', 'activity', 'notes', 'uptime']

export type BentoGridProps = {
  tiles?: BentoTile[]
  /** Tile ids, first to last. */
  order?: string[]
  defaultOrder?: string[]
  onOrderChange?: (order: string[]) => void
  /** Tile ids on a phone until someone moves one. Default the Figma order. */
  mobileOrder?: string[]
  /** Shows a state for previews: Revenue raised, or Notes lifted. */
  preview?: 'hover' | 'lifted'
  /** Accessible name of the grid. */
  label?: string
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const moved = (order: string[], id: string, to: number): string[] => {
  const rest = order.filter((item) => item !== id)
  return [...rest.slice(0, to), id, ...rest.slice(to)]
}

type Box = { x: number; y: number; width: number; height: number; spans: number }

/** Grid auto flow dense: each tile takes the first gap that fits it. Native has no grid, so the tiles are placed by hand. */
function layOut(ids: string[], spansOf: (id: string) => number, columns: number, cell: number, row: number): { boxes: Map<string, Box>; height: number } {
  const taken: boolean[][] = []
  const boxes = new Map<string, Box>()
  let rows = 0
  for (const id of ids) {
    const spans = Math.min(spansOf(id), columns)
    for (let y = 0, placed = false; !placed; y++) {
      const line = (taken[y] ??= Array.from({ length: columns }, () => false))
      for (let x = 0; x + spans <= columns && !placed; x++) {
        if (line.slice(x, x + spans).some(Boolean)) continue
        line.fill(true, x, x + spans)
        boxes.set(id, { x: x * (cell + GUTTER), y: y * (row + GUTTER), width: spans * cell + (spans - 1) * GUTTER, height: row, spans })
        rows = Math.max(rows, y + 1)
        placed = true
      }
    }
  }
  return { boxes, height: rows * row + Math.max(rows - 1, 0) * GUTTER }
}

type TileViewProps = {
  id: string
  tile: BentoTile
  box: Box
  size: BentoTile['size']
  entries: MenuEntry[]
  moveLabel: string
  lifted: boolean
  quiet: boolean
  settling: boolean
  previewLift: boolean
  hovered: boolean
  still: boolean
  animated: boolean
  renderIcon: RenderIcon
  dragEnabled: boolean
  onPickUp: (id: string) => void
  onOver: (id: string, x: number, y: number) => void
  onDrop: (id: string) => void
}

function TileView({ id, tile, box, size, entries, moveLabel, lifted, quiet, settling, previewLift, hovered, still, animated, renderIcon, dragEnabled, onPickUp, onOver, onDrop }: TileViewProps) {
  const styles = useThemed(createStyles)
  const x = useSharedValue(box.x)
  const y = useSharedValue(box.y)
  const fromX = useSharedValue(0)
  const fromY = useSharedValue(0)
  const quietness = useSharedValue(1)
  const tilt = useSharedValue(0)
  const tilted = lifted && !still && !settling

  useEffect(() => {
    if (lifted && !settling) return
    x.value = still ? box.x : withSpring(box.x, DROP_SPRING)
    y.value = still ? box.y : withSpring(box.y, DROP_SPRING)
  }, [box.x, box.y, lifted, settling, still, x, y])

  useEffect(() => {
    const to = quiet || (lifted && still) ? 0.4 : 1
    quietness.value = still ? to : withTiming(to, QUIET)
  }, [lifted, quiet, quietness, still])

  useEffect(() => {
    tilt.value = withSpring(tilted ? 1 : 0, tilted ? LIFT_SPRING : DROP_SPRING)
  }, [tilt, tilted])

  const pan = useMemo(() => Gesture.Pan()
    .enabled(dragEnabled)
    .activateAfterLongPress(HOLD_DELAY)
    .onStart(() => {
      fromX.value = x.value
      fromY.value = y.value
      runOnJS(onPickUp)(id)
    })
    .onUpdate((event) => {
      if (still) {
        runOnJS(onOver)(id, fromX.value + event.translationX + box.width / 2, fromY.value + event.translationY + box.height / 2)
        return
      }
      x.value = fromX.value + event.translationX
      y.value = fromY.value + event.translationY
      runOnJS(onOver)(id, x.value + box.width / 2, y.value + box.height / 2)
    })
    .onEnd(() => { runOnJS(onDrop)(id) }), [box.height, box.width, dragEnabled, fromX, fromY, id, onDrop, onOver, onPickUp, still, x, y])

  const place = useAnimatedStyle(() => ({
    height: box.height,
    opacity: quietness.value,
    width: box.width,
    zIndex: lifted ? 4 : 1,
    transform: [
      { translateX: x.value + (previewLift ? PREVIEW.x : 0) },
      { translateY: y.value + (previewLift ? PREVIEW.y : 0) },
      { rotate: `${previewLift ? LIFT_ROTATE : tilt.value * LIFT_ROTATE}deg` },
      { scale: 1 + tilt.value * (LIFT_SCALE - 1) },
    ],
  }), [box.height, box.width, lifted, previewLift])

  const grip = (
    <DropdownMenu
      label={moveLabel}
      entries={entries}
      align="end"
      animated={animated}
      trigger={(props) => (
        <GestureDetector gesture={pan}>
          <Pressable {...props} accessibilityRole="button" accessibilityLabel={moveLabel} hitSlop={GRIP_SLOP} style={styles.grip}>
            <BentoGripDots hovered={hovered || lifted} />
          </Pressable>
        </GestureDetector>
      )}
    />
  )
  const widget = { widget: tile.widget, data: tile.data, size, grip, fill: true, hovered: hovered || lifted, renderIcon, animated } as BentoWidgetProps

  return <Animated.View style={[styles.tile, place]}><BentoWidget {...widget} style={lifted && still ? styles.stillRing : undefined} /></Animated.View>
}

/** The dashed place where a lifted tile lands. */
function Slot({ box }: { box: Box }) {
  const styles = useThemed(createStyles)
  const place = useAnimatedStyle(() => ({ height: box.height, left: box.x, top: box.y, width: box.width }), [box.height, box.width, box.x, box.y])
  return <Animated.View style={[styles.slot, place]} />
}

/** Bento Widgets on the Soft tray with 4 gutters. Hold a grip to drag it, or tap it for the Move menu. */
export function BentoGrid({ tiles = BENTO_TILES, order, defaultOrder, onOrderChange, mobileOrder = MOBILE_ORDER, preview, label = 'Dashboard', renderIcon, animated = true, style }: BentoGridProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(() => defaultOrder ?? tiles.map(({ id }) => id))
  const [rearranged, setRearranged] = useState(false)
  const [lifted, setLifted] = useState<string | null>(null)
  const [settling, setSettling] = useState(false)
  const [width, setWidth] = useState(0)
  const current = order ?? held
  const narrow = width < WIDE_WIDTH
  const columns = narrow ? 2 : 3
  const rowHeight = narrow ? ROW_HEIGHT.narrow : ROW_HEIGHT.wide
  const cell = (width - (columns - 1) * GUTTER) / columns
  const shownOrder = narrow && !rearranged ? [...current].sort((a, b) => mobileOrder.indexOf(a) - mobileOrder.indexOf(b)) : current

  const byId = useMemo(() => new Map(tiles.map((tile) => [tile.id, tile])), [tiles])
  const name = useCallback((id: string): string => byId.get(id)?.widget.replace('-', ' ') ?? id, [byId])
  const sizeOf = useCallback((id: string): BentoTile['size'] => {
    const tile = byId.get(id)
    return (narrow ? tile?.mobileSize ?? tile?.size : tile?.size) ?? 'small'
  }, [byId, narrow])

  const { boxes, height } = useMemo(() => layOut(shownOrder.filter((id) => byId.has(id)), (id) => (sizeOf(id) === 'medium' ? 2 : 1), columns, cell, rowHeight), [byId, cell, columns, rowHeight, shownOrder, sizeOf])

  const latest = useRef({ order: shownOrder, boxes, onOrderChange })
  latest.current = { order: shownOrder, boxes, onOrderChange }

  const move = useCallback((id: string, to: number) => {
    const list = latest.current.order
    const clamped = Math.max(0, Math.min(list.length - 1, to))
    if (list.indexOf(id) === clamped) return
    const next = moved(list, id, clamped)
    setHeld(next)
    setRearranged(true)
    latest.current.onOrderChange?.(next)
    AccessibilityInfo.announceForAccessibility(`${name(id)} moved to position ${clamped + 1} of ${list.length}.`)
  }, [name])

  const pickUp = useCallback((id: string) => {
    setLifted(id)
    AccessibilityInfo.announceForAccessibility(`${name(id)} picked up.`)
  }, [name])

  const over = useCallback((id: string, x: number, y: number) => {
    for (const [other, box] of latest.current.boxes) {
      if (other === id) continue
      if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) {
        move(id, latest.current.order.indexOf(other))
        return
      }
    }
  }, [move])

  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(settle.current), [])

  const drop = useCallback((id: string) => {
    AccessibilityInfo.announceForAccessibility(`${name(id)} dropped.`)
    if (still) { setLifted(null); return }
    setSettling(true)
    settle.current = setTimeout(() => { setLifted(null); setSettling(false) }, DROP_SPRING.duration)
  }, [name, still])

  const menu = (id: string, index: number): MenuEntry[] => [
    { label: 'Move earlier', disabled: index === 0, onSelect: () => move(id, index - 1) },
    { label: 'Move later', disabled: index === shownOrder.length - 1, onSelect: () => move(id, index + 1) },
    { kind: 'separator' },
    { label: 'Move to start', disabled: index === 0, onSelect: () => move(id, 0) },
    { label: 'Move to end', disabled: index === shownOrder.length - 1, onSelect: () => move(id, shownOrder.length - 1) },
  ]

  const previewLift = preview === 'lifted' ? 'notes' : null
  const shownLift = lifted ?? previewLift
  const liftBox = shownLift ? boxes.get(shownLift) : undefined
  const gridStyle = useAnimatedStyle(() => ({ height }), [height])

  return (
    <View role="group" accessibilityLabel={label} style={[styles.tray, style]}>
      <Animated.View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={gridStyle}>
        {liftBox ? <Slot box={liftBox} /> : null}
        {width > 0 ? shownOrder.map((id, index) => {
          const tile = byId.get(id)
          const box = boxes.get(id)
          if (!tile || !box) return null
          return (
            <TileView
              key={id}
              id={id}
              tile={tile}
              box={box}
              size={sizeOf(id)}
              entries={menu(id, index)}
              moveLabel={`Move ${name(id)}`}
              lifted={shownLift === id}
              quiet={Boolean(shownLift) && shownLift !== id}
              settling={settling}
              previewLift={previewLift === id}
              hovered={preview === 'hover' && id === 'revenue'}
              still={still}
              animated={animated}
              renderIcon={renderIcon}
              dragEnabled={!preview}
              onPickUp={pickUp}
              onOver={over}
              onDrop={drop}
            />
          )
        }) : null}
      </Animated.View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: 664, padding: space[1], width: '100%' },
  tile: { left: 0, position: 'absolute', top: 0 },
  grip: { alignItems: 'center', borderRadius: radius.full, height: 28, justifyContent: 'center', width: 28 },
  slot: { borderColor: c.textTertiary, borderRadius: radius.card, borderStyle: 'dashed', borderWidth: 1.5, position: 'absolute' },
  stillRing: { borderColor: c.textPrimary, borderWidth: 2 },
})
