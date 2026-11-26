import { useId, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View, type DimensionValue, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const FADE_MS = 160
const FADE_TOP = 28
const FADE_END = 56
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
/** Mobile bar from the web: 6 wide with a 3 point thumb, 2 in from the edge, never shorter than 32. */
const BAR = 6
const BAR_INSET = 2
const MIN_THUMB = 32

type Edge = 'top' | 'bottom' | 'end'

function Fade({ edge, shown }: { edge: Edge; shown: SharedValue<number> }) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const motion = useAnimatedStyle(() => ({ opacity: shown.value }))
  // One id per fade: two scroll areas on a screen must not share a gradient id.
  const gid = `fade-${edge}-${useId().replace(/:/g, '')}`
  const coords = edge === 'top' ? { x1: '0', y1: '0', x2: '0', y2: '1' } : edge === 'bottom' ? { x1: '0', y1: '1', x2: '0', y2: '0' } : { x1: '1', y1: '0', x2: '0', y2: '0' }
  return (
    <Animated.View pointerEvents="none" style={[styles[`fade_${edge}` as const], motion]}>
      <Svg aria-hidden width="100%" height="100%">
        <Defs>
          <LinearGradient id={gid} {...coords}>
            <Stop offset="0" stopColor={colors.surface} />
            <Stop offset="1" stopColor={colors.surface} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gid})`} />
      </Svg>
    </Animated.View>
  )
}

export type ScrollAreaProps = {
  /** Names the region for screen readers. */
  label: string
  children: ReactNode
  orientation?: 'vertical' | 'horizontal' | 'both'
  /** Edge fades show there is more. Default on. */
  fades?: boolean
  /** Wraps the area in the Soft tray with this header. */
  shell?: { title: ReactNode; meta?: ReactNode; actions?: ReactNode }
  /** Height of the viewport, such as 320. */
  height?: DimensionValue
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A region that scrolls inside a fixed frame, with the web's thin overlay bar and edge fades. Momentum stays native. */
export function ScrollArea({ label, children, orientation = 'vertical', fades = true, shell, height, animated = true, style }: ScrollAreaProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const top = useSharedValue(0)
  const bottom = useSharedValue(0)
  const end = useSharedValue(0)
  const [view, setView] = useState({ width: 0, height: 0 })
  const [size, setSize] = useState({ width: 0, height: 0 })
  const fadeMs = still ? 0 : FADE_MS

  // The overlay bar: the web's thin thumb, drawn over the content in its own gutter, so it shows at rest too.
  const offset = useSharedValue(0)
  const viewH = useSharedValue(0)
  const contentH = useSharedValue(0)
  const thumb = useAnimatedStyle(() => {
    const room = viewH.value - BAR_INSET * 2 - 4
    const fits = contentH.value <= viewH.value + 1 || room <= 0
    const size = fits ? 0 : Math.max(MIN_THUMB, (viewH.value / contentH.value) * room)
    const progress = fits ? 0 : Math.min(1, Math.max(0, offset.value / (contentH.value - viewH.value)))
    return { height: size, opacity: fits ? 0 : 1, transform: [{ translateY: progress * (room - size) }] }
  })

  const handler = useAnimatedScrollHandler({
    onScroll: (e) => {
      offset.value = e.contentOffset.y
      top.value = withTiming(e.contentOffset.y > 1 ? 1 : 0, { duration: fadeMs, easing: OUT })
      bottom.value = withTiming(e.contentOffset.y + e.layoutMeasurement.height < e.contentSize.height - 1 ? 1 : 0, { duration: fadeMs, easing: OUT })
      end.value = withTiming(e.contentOffset.x + e.layoutMeasurement.width < e.contentSize.width - 1 ? 1 : 0, { duration: fadeMs, easing: OUT })
    },
  })

  function sync(nextView: { width: number; height: number }, nextSize: { width: number; height: number }): void {
    bottom.value = nextSize.height > nextView.height + 1 ? 1 : 0
    end.value = nextSize.width > nextView.width + 1 ? 1 : 0
  }
  function onLayout(e: LayoutChangeEvent): void {
    const next = { width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height }
    viewH.value = next.height
    setView(next)
    sync(next, size)
  }
  function onContent(width: number, contentHeight: number): void {
    const next = { width, height: contentHeight }
    contentH.value = contentHeight
    setSize(next)
    sync(view, next)
  }

  const overflows = size.height > view.height + 1
  const both = orientation === 'both'
  const horizontal = orientation === 'horizontal'
  const content = both ? <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>{children}</ScrollView> : children
  const area = (
    <View style={[styles.frame, height === undefined ? null : sizeOf(height), shell ? null : style]}>
      <Animated.ScrollView
        accessibilityLabel={label}
        horizontal={horizontal}
        nestedScrollEnabled
        scrollEventThrottle={16}
        onScroll={handler}
        onLayout={onLayout}
        onContentSizeChange={onContent}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={horizontal}
        contentContainerStyle={!horizontal && overflows ? styles.gutter : undefined}
      >
        {content}
      </Animated.ScrollView>
      {!horizontal ? <View pointerEvents="none" style={styles.bar}><Animated.View style={[styles.thumb, thumb]} /></View> : null}
      {fades && orientation !== 'vertical' ? <Fade edge="end" shown={end} /> : null}
      {fades && !horizontal ? <><Fade edge="top" shown={top} /><Fade edge="bottom" shown={bottom} /></> : null}
    </View>
  )

  if (!shell) return area
  return (
    <View style={[styles.tray, style]}>
      <View style={styles.shellHeader}>
        {typeof shell.title === 'string' ? <Text style={styles.shellTitle}>{shell.title}</Text> : shell.title}
        <View style={styles.spacer} />
        {typeof shell.meta === 'string' ? <Text style={styles.shellMeta}>{shell.meta}</Text> : shell.meta}
        {shell.actions ? <View style={styles.shellActions}>{shell.actions}</View> : null}
      </View>
      <View style={styles.body}>{area}</View>
    </View>
  )
}

const sizeOf = (height: DimensionValue): ViewStyle => ({ height })

const makeStyles = (c: Colors) => StyleSheet.create({
  frame: { minWidth: 0, overflow: 'hidden' },
  gutter: { paddingRight: BAR + 6 },
  bar: { position: 'absolute', top: BAR_INSET, right: BAR_INSET, bottom: BAR_INSET, width: BAR, paddingVertical: 2, zIndex: 2 },
  thumb: { alignSelf: 'center', width: 3, borderRadius: radius.full, backgroundColor: c.ink10 },
  fade_top: { position: 'absolute', top: 0, left: 0, right: 0, height: FADE_TOP },
  fade_bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: FADE_END },
  fade_end: { position: 'absolute', top: 0, right: 0, bottom: 0, width: FADE_END },
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  shellHeader: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 36, paddingHorizontal: space[3] },
  shellTitle: type(14, c.textPrimary, '500'),
  shellMeta: type(12, c.textTertiary, '400', true),
  shellActions: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  spacer: { flex: 1 },
  body: { padding: space[1.5], overflow: 'hidden', borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
})
