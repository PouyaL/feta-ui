import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'

/** The Table Motion frame: neighbors slide 200 ms. */
const NEIGHBOR_MS = 200
const LIFT = { scale: 1.02, rotate: -2 } as const
const LIFT_SPRING = { duration: 200, dampingRatio: 1 } as const
const DROP_SPRING = { duration: 300, dampingRatio: 0.8 } as const
const ROW_GAP = 4
const neighbor = LinearTransition.duration(NEIGHBOR_MS).easing(Easing.bezierFn(0.23, 1, 0.32, 1))

export type SortableItem = { id: string; title: ReactNode; subtitle?: ReactNode; /** Text for announcements, when `title` is not text. */ text?: string }

export type SortableListProps = {
  items: SortableItem[]
  onReorder?: (items: SortableItem[]) => void
  label: string
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const pad = (n: number): string => String(n).padStart(2, '0')
const move = <T,>(list: T[], from: number, to: number): T[] => {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}
const nameOf = (item: SortableItem | undefined): string => item?.text ?? (typeof item?.title === 'string' ? item.title : 'Item')

type RowProps = { item: SortableItem; index: number; total: number; still: boolean; renderIcon: RenderIcon; onLift: (id: string) => void; onDrag: (moved: number) => number; onDrop: () => void; onStep: (id: string, by: number) => void }

function Row({ item, index, total, still, renderIcon, onLift, onDrag, onDrop, onStep }: RowProps) {
  const styles = useThemed(makeStyles)
  const [lifted, setLifted] = useState(false)
  const y = useSharedValue(0)
  const lift = useSharedValue(0)
  const pickUp = (): void => {
    setLifted(true)
    onLift(item.id)
  }
  const follow = (moved: number): void => { y.value = moved - onDrag(moved) }
  const release = (): void => {
    setLifted(false)
    onDrop()
    y.value = still ? 0 : withSpring(0, DROP_SPRING)
  }
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin(() => {
      if (!still) lift.value = withSpring(1, LIFT_SPRING)
      runOnJS(pickUp)()
    })
    .onUpdate((e) => { runOnJS(follow)(e.translationY) })
    .onFinalize(() => {
      if (!still) lift.value = withSpring(0, DROP_SPRING)
      runOnJS(release)()
    })
  const motion = useAnimatedStyle(() => ({
    zIndex: lift.value > 0 ? 1 : 0,
    transform: [{ translateY: y.value }, { scale: 1 + (LIFT.scale - 1) * lift.value }, { rotate: `${LIFT.rotate * lift.value}deg` }],
  }))
  const name = nameOf(item)
  return (
    <Animated.View {...(still ? {} : { layout: neighbor })} style={styles.slot}>
      <Animated.View style={[styles.item, lifted ? styles.itemLifted : null, motion]}>
        <GestureDetector gesture={pan}>
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={`Reorder ${name}, position ${index + 1} of ${total}`}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={index + 1}
            aria-valuetext={`Position ${index + 1} of ${total}`}
            accessibilityActions={[{ name: 'increment', label: 'Move up' }, { name: 'decrement', label: 'Move down' }]}
            onAccessibilityAction={(e) => onStep(item.id, e.nativeEvent.actionName === 'increment' ? -1 : 1)}
            style={styles.grip}
          >
            {renderIcon('grip-vertical', 16)}
          </View>
        </GestureDetector>
        <View style={styles.text}>
          {typeof item.title === 'string' ? <Text style={styles.title} numberOfLines={1}>{item.title}</Text> : item.title}
          {typeof item.subtitle === 'string' ? <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text> : item.subtitle}
        </View>
        <Text style={styles.order}>{pad(index + 1)}</Text>
      </Animated.View>
    </Animated.View>
  )
}

/** Reorder by dragging the grip, or step with a screen reader. The item lifts at −2° over a dashed slot. */
export function SortableList({ items: start, onReorder, label, renderIcon, animated = true, style }: SortableListProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [items, setItems] = useState(start)
  const latest = useRef(items)
  latest.current = items
  const rowHeight = useRef(64)
  const drag = useRef({ startIndex: 0, index: 0 })
  useEffect(() => setItems(start), [start])

  function onLift(id: string): void {
    const index = latest.current.findIndex((item) => item.id === id)
    drag.current = { startIndex: index, index }
  }

  /** Moves the row to where the finger is, and returns how far the list already shifted it. */
  function onDrag(moved: number): number {
    const { startIndex, index } = drag.current
    const height = rowHeight.current + ROW_GAP
    const target = Math.max(0, Math.min(latest.current.length - 1, startIndex + Math.round(moved / height)))
    if (target !== index) {
      drag.current.index = target
      setItems((list) => move(list, index, target))
    }
    return (target - startIndex) * height
  }

  function onDrop(): void {
    const { index } = drag.current
    onReorder?.(latest.current)
    AccessibilityInfo.announceForAccessibility(`${nameOf(latest.current[index])} dropped at position ${index + 1}.`)
  }

  function onStep(id: string, by: number): void {
    const list = latest.current
    const index = list.findIndex((item) => item.id === id)
    const to = index + by
    if (to < 0 || to >= list.length) return
    const next = move(list, index, to)
    setItems(next)
    onReorder?.(next)
    AccessibilityInfo.announceForAccessibility(`Moved to position ${to + 1} of ${list.length}.`)
  }

  return (
    <View accessibilityLabel={label} style={[styles.list, style]} onLayout={(e) => { if (items.length) rowHeight.current = (e.nativeEvent.layout.height - space[1] * 2) / items.length - ROW_GAP }}>
      {items.map((item, index) => <Row key={item.id} item={item} index={index} total={items.length} still={still} renderIcon={renderIcon} onLift={onLift} onDrag={onDrag} onDrop={onDrop} onStep={onStep} />)}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  list: { width: '100%', gap: ROW_GAP, padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  slot: { borderRadius: radius.card, borderWidth: 1, borderStyle: 'dashed', borderColor: c.ink10 },
  item: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 64, paddingRight: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  itemLifted: { borderColor: c.textPrimary },
  grip: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44 },
  text: { flex: 1, minWidth: 0 },
  title: type(14, c.textPrimary, '500'),
  subtitle: type(12, c.textSecondary),
  order: type(12, c.textTertiary, '400', true),
})
