import { useMemo, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, ZoomIn, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed } from './card'
import { animateTo, EASE_OUT, Mark } from './popover'
import { Switch } from './switch'

const PUSH_MS = 340
const POP_MS = 300
const IOS_EASE = Easing.bezierFn(0.32, 0.72, 0, 1)
const PARENT_SHIFT = 0.18
/** A swipe back past this share of the width commits on release. */
const POP_AT = 0.4
/** A flick faster than this, in px/s, decides on its own: rightward commits, leftward cancels. */
const FLICK_SPEED = 500
/** A committed swipe finishes the rest of the way in proportion, but never quicker than this. */
const MIN_FINISH_MS = 100
/** Swipe back starts within this far of the left edge. */
const EDGE_PX = 24
const DRAG_START = 8
const CHECK_IN = ZoomIn.duration(160).easing(EASE_OUT).withInitialValues({ transform: [{ scale: 0.8 }] })

export type StackRow =
  | { kind?: 'link'; id: string; label: string; icon?: ReactNode; detail?: string; to: string }
  | { kind: 'choice'; id: string; label: string; group: string; defaultOn?: boolean }
  | { kind: 'switch'; id: string; label: string; detail?: string; defaultOn?: boolean; onChange?: (on: boolean) => void }
  | { kind: 'value'; id: string; label: string; detail: string }
  | { kind: 'danger'; id: string; label: string; onSelect?: () => void }

export type StackSection = { title?: string; note?: string; rows: StackRow[] }
export type StackPage = { title: string; sections: StackSection[] }

export type StackPanelProps = {
  /** Every page, by id. */
  pages: Record<string, StackPage>
  root: string
  /** Starts deeper in. Ids from the root's child down. */
  defaultPath?: string[]
  onPathChange?: (path: string[]) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const parentOf = (path: string[], root: string): string | null => (path.length ? path[path.length - 2] ?? root : null)

/** A settings panel that drills into pages and back. Swipe back reveals the parent underneath. */
export function StackPanel({ pages, root, defaultPath = [], onPathChange, animated = true, style }: StackPanelProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [path, setPath] = useState(defaultPath)
  const [top, setTop] = useState(defaultPath[defaultPath.length - 1] ?? root)
  const [under, setUnder] = useState<string | null>(parentOf(defaultPath, root))
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [switches, setSwitches] = useState<Record<string, boolean>>({})
  const [width, setWidth] = useState(0)
  const busy = useRef(false)
  // The top page's offset. The page under it is always derived from this, so a finger drives both.
  const x = useSharedValue(0)
  const page = pages[top]

  function push(to: string): void {
    if (busy.current) return
    const next = [...path, to]
    setUnder(top)
    setTop(to)
    setPath(next)
    onPathChange?.(next)
    AccessibilityInfo.announceForAccessibility(pages[to]?.title ?? '')
    if (still) return
    busy.current = true
    x.value = width
    x.value = animateTo(0, { duration: PUSH_MS, easing: IOS_EASE }, () => { busy.current = false })
  }

  function landPop(next: string[]): void {
    const id = next[next.length - 1] ?? root
    setTop(id)
    setUnder(parentOf(next, root))
    x.value = 0
    busy.current = false
  }

  function pop(): void {
    if (!path.length || busy.current) return
    const next = path.slice(0, -1)
    setPath(next)
    onPathChange?.(next)
    AccessibilityInfo.announceForAccessibility(pages[next[next.length - 1] ?? root]?.title ?? '')
    if (still) { landPop(next); return }
    busy.current = true
    // After a swipe the page carries on from the finger, over the remaining share of POP_MS.
    const left = width > 0 ? 1 - Math.min(1, Math.max(0, x.value / width)) : 1
    x.value = animateTo(width, { duration: Math.max(MIN_FINISH_MS, POP_MS * left), easing: IOS_EASE }, () => landPop(next))
  }

  const swipe = useMemo(() => Gesture.Pan()
    .enabled(path.length > 0 && width > 0)
    .hitSlop({ left: 0, width: EDGE_PX })
    .activeOffsetX(DRAG_START)
    .failOffsetY([-DRAG_START, DRAG_START])
    .onUpdate((e) => { x.value = Math.max(0, Math.min(width, e.translationX)) })
    .onEnd((e) => {
      if (e.velocityX > FLICK_SPEED || (e.translationX > width * POP_AT && e.velocityX > -FLICK_SPEED)) runOnJS(pop)()
      else x.value = withTiming(0, { duration: still ? 0 : POP_MS, easing: EASE_OUT })
    // `pop` reads the path, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [path, still, width, x])

  const topStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const underStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -PARENT_SHIFT * (width - x.value) }] }), [width])

  const rowView = (row: StackRow, rule: boolean): ReactNode => {
    const line = [styles.row, rule && styles.rowRule]
    if (row.kind === 'switch') {
      const on = switches[row.id] ?? row.defaultOn ?? false
      return (
        <View key={row.id} style={line}>
          <View style={styles.rowLabel}>
            <Text style={styles.label}>{row.label}</Text>
            {row.detail ? <Text style={styles.small}>{row.detail}</Text> : null}
          </View>
          <Switch accessibilityLabel={row.label} checked={on} animated={animated} onCheckedChange={(next) => { setSwitches({ ...switches, [row.id]: next }); row.onChange?.(next) }} />
        </View>
      )
    }
    if (row.kind === 'value') return <View key={row.id} style={line}><View style={styles.rowLabel}><Text style={styles.label}>{row.label}</Text></View><Text style={styles.detail}>{row.detail}</Text></View>
    if (row.kind === 'danger') return <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={row.label} onPress={row.onSelect} style={line}><Text style={[styles.label, styles.danger]}>{row.label}</Text></Pressable>
    if (row.kind === 'choice') {
      const on = (choices[row.group] ?? (row.defaultOn ? row.id : undefined)) === row.id
      return (
        <Pressable key={row.id} accessibilityRole="radio" accessibilityLabel={row.label} aria-checked={on} onPress={() => setChoices({ ...choices, [row.group]: row.id })} style={line}>
          <View style={styles.rowLabel}><Text style={styles.label}>{row.label}</Text></View>
          {on ? <Animated.View {...(still ? {} : { entering: CHECK_IN })}><Mark name="tick" size={20} /></Animated.View> : null}
        </Pressable>
      )
    }
    return (
      <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={row.label} {...(row.detail ? { 'aria-valuetext': row.detail } : {})} onPress={() => push(row.to)} style={line}>
        {row.icon ?? null}
        <View style={styles.rowLabel}><Text style={styles.label}>{row.label}</Text></View>
        {row.detail ? <Text style={styles.detail}>{row.detail}</Text> : null}
        <Mark name="chevron-right" size={20} color={colors.textSecondary} />
      </Pressable>
    )
  }

  const sections = (target: StackPage): ReactNode => target.sections.map((section, i) => (
    <View key={section.title ?? i} style={styles.section}>
      {section.title ? <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text> : null}
      <View accessibilityRole={section.rows.some((row) => row.kind === 'choice') ? 'radiogroup' : 'none'} accessibilityLabel={section.title} style={styles.card}>{section.rows.map((row, r) => rowView(row, r > 0))}</View>
      {section.note ? <Text style={styles.note}>{section.note}</Text> : null}
    </View>
  ))

  const parent = under ? pages[under] : undefined
  const parentTitle = parent?.title

  return (
    <View style={[styles.panel, style]}>
      <GestureDetector gesture={swipe}>
        <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.viewport}>
          {parent ? (
            <Animated.View aria-hidden pointerEvents="none" style={[styles.under, underStyle]}>
              <View style={styles.nav} />
              {sections(parent)}
            </Animated.View>
          ) : null}
          <Animated.View style={[styles.sheet, topStyle]}>
            <View style={styles.nav}>
              {parentTitle ? <Button variant="ghost" size="sm" shape="pill" animated={animated} leadingIcon={<Mark name="chevron-left" />} onPress={pop}>{parentTitle}</Button> : null}
              <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{page?.title}</Text>
            </View>
            {page ? sections(page) : null}
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  panel: { backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: '100%', padding: space[1], width: 358 },
  viewport: { borderRadius: radius.card, overflow: 'hidden' },
  sheet: { backgroundColor: c.muted, width: '100%' },
  under: { ...StyleSheet.absoluteFill, backgroundColor: c.muted },
  nav: { alignItems: 'center', flexDirection: 'row', minHeight: 48, padding: space[1.5] },
  title: { ...type(14, c.textPrimary, '500'), left: 96, lineHeight: 20, position: 'absolute', right: 96, textAlign: 'center' },
  section: { paddingBottom: space[2] },
  sectionTitle: { color: c.textTertiary, fontFamily: font.mono, fontSize: 10, lineHeight: 14, paddingBottom: space[1.5], paddingHorizontal: space[3], paddingTop: space[3], textTransform: 'uppercase' },
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[2.5], minHeight: 52, paddingHorizontal: space[3], paddingVertical: space[1] },
  rowRule: { borderTopColor: c.ink5, borderTopWidth: 1 },
  rowLabel: { flex: 1, minWidth: 0 },
  label: { ...type(14, c.textPrimary), lineHeight: 20 },
  danger: { color: c.danger },
  small: { ...type(12, c.textSecondary), lineHeight: 16 },
  detail: { ...type(14, c.textSecondary), lineHeight: 20 },
  note: { ...type(12, c.textSecondary), lineHeight: 16, paddingHorizontal: space[3], paddingTop: space[1.5] },
})
