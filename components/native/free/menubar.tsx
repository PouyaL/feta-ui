import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { hscroll, radius, softElevation, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { Menu, useMenuStore, type MenuEntry } from './dropdown-menu'
import { EASE_OUT, Floating, useCompact, type FloatingMotion, type Point } from './popover'

const SLIDE = { stiffness: 420, damping: 34 }
const GAP = 6
const MENU_WIDTH = 248
const COMPACT_WIDTH = 358
const FADE_MS = 120

const MOTION: FloatingMotion = { from: { opacity: 0, scale: 0.98, shift: 4 }, open: { duration: 160, easing: EASE_OUT }, close: { duration: FADE_MS } }

export type MenubarMenu = {
  label: string
  entries: MenuEntry[]
  disabled?: boolean
}

export type MenubarProps = {
  menus: MenubarMenu[]
  /** The bar's spoken name. */
  label: string
  /** Opens this menu on mount. */
  defaultOpen?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Rect = { x: number; y: number; width: number; height: number }

const inside = (point: Point, box: Rect): boolean => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height

/** A persistent row of menus. The open tab slides between triggers and menus swap at once, so scanning stays fast. */
export function Menubar({ menus, label, defaultOpen, animated = true, style }: MenubarProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const compact = useCompact()
  const store = useMenuStore()
  const initial = menus.findIndex((menu) => menu.label === defaultOpen)
  const [open, setOpen] = useState<number | null>(initial < 0 ? null : initial)
  const anchor = useRef<ComponentRef<typeof View> | null>(null)
  const nodes = useRef<(ComponentRef<typeof View> | null)[]>([])
  const boxes = useRef<{ x: number; width: number }[]>([])
  const rects = useRef<Rect[]>([])
  const last = useRef<MenubarMenu | undefined>(undefined)
  const tabX = useSharedValue(0)
  const tabWidth = useSharedValue(0)
  const tabOpacity = useSharedValue(0)
  const current = open === null ? undefined : menus[open]
  if (current) last.current = current
  const menu = last.current

  const slideTab = (index: number): void => {
    const box = boxes.current[index]
    if (!box) return
    const slides = !still && tabOpacity.value > 0
    tabX.value = slides ? withSpring(box.x, SLIDE) : box.x
    tabWidth.value = slides ? withSpring(box.width, SLIDE) : box.width
    tabOpacity.value = 1
  }

  function show(index: number): void {
    anchor.current = nodes.current[index] ?? null
    slideTab(index)
    setOpen(index)
  }

  function close(): void {
    setOpen(null)
    tabOpacity.value = withTiming(0, { duration: still ? 0 : FADE_MS })
  }

  // The window under an open menu takes the first tap, so a tap on another trigger is passed along to it.
  useEffect(() => {
    if (open === null) return
    nodes.current.forEach((node, index) => node?.measureInWindow((x, y, width, height) => { rects.current[index] = { x, y, width, height } }))
  }, [open])

  function onDismiss(point?: Point): void {
    const hit = point ? rects.current.findIndex((box) => inside(point, box)) : -1
    if (hit >= 0 && hit !== open && !menus[hit]?.disabled) show(hit)
    else close()
  }

  const measure = (index: number) => (e: LayoutChangeEvent): void => {
    const { x, width } = e.nativeEvent.layout
    boxes.current[index] = { x, width }
    if (index === open) slideTab(index)
  }

  const tab = useAnimatedStyle(() => ({ opacity: tabOpacity.value, width: tabWidth.value, transform: [{ translateX: tabX.value }] }))

  return (
    <View style={[styles.root, style]}>
      <View accessibilityRole="menubar" accessibilityLabel={label} style={styles.bar}>
        <ScrollView style={hscroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
          <Animated.View pointerEvents="none" style={[styles.tab, tab]} />
          {menus.map((item, index) => (
            <View
              key={item.label}
              ref={(node) => {
                nodes.current[index] = node
                if (index === initial && !anchor.current) anchor.current = node
              }}
              collapsable={false}
              onLayout={measure(index)}
            >
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                aria-expanded={open === index}
                aria-disabled={Boolean(item.disabled)}
                disabled={item.disabled}
                onPress={() => { if (open === index) close(); else show(index) }}
                style={[styles.trigger, Boolean(item.disabled) && styles.off]}
              >
                <Text style={[styles.label, open === index && styles.labelOpen]}>{item.label}</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </View>
      {/* Keyed by menu, so content swaps with no fade while the panel stays put. */}
      <Floating anchor={anchor} anchorKey={open ?? undefined} open={open !== null} side="bottom" align="start" offset={GAP} width={compact ? COMPACT_WIDTH : MENU_WIDTH} motion={MOTION} animated={animated} onDismiss={onDismiss}>
        {() => (menu ? <Menu key={menu.label} entries={menu.entries} label={menu.label} store={store} still={still} onClose={close} /> : <View />)}
      </Floating>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  root: { alignSelf: 'stretch' },
  bar: { backgroundColor: c.ink4, borderRadius: radius.control, padding: space[1] },
  track: { flexDirection: 'row', gap: space[0.5] },
  tab: { boxShadow: softElevation(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.field, borderWidth: 1, bottom: 0, left: 0, position: 'absolute', top: 0 },
  trigger: { alignItems: 'center', borderRadius: radius.field, justifyContent: 'center', minHeight: 44, paddingHorizontal: space[3.5] },
  off: { opacity: 0.4 },
  label: { ...type(15, c.textSecondary, '500'), lineHeight: 20 },
  labelOpen: { color: c.textPrimary },
})
