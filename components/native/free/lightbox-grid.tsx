import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackHandler, Image, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeIn, FadeOut, LayoutAnimationConfig, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg'
import { font, pressedState, radius, space, useColors, type Colors } from '../kit'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
/** Open photo: 350 ms spring, bounce 0.25, tile to viewer. */
const ZOOM = { duration: 350, dampingRatio: 0.75 } as const
/** Dismiss photo: 300 ms in all, shrink first and then back to the tile. */
const DISMISS_STEP_MS = 150
const DISMISS_STEP = { duration: DISMISS_STEP_MS, easing: EASE_OUT }
const DISMISS_SCALE = 0.9
const DIM = { duration: 260, easing: EASE_OUT }
const FADE_MS = 150
const fadeIn = FadeIn.duration(FADE_MS)
const fadeOut = FadeOut.duration(FADE_MS)
/** Swipe down past this to close. */
const SWIPE_CLOSE = 80
const SWIPE_ELASTIC = 0.6
const ZOOMED_SCALE = 1.6
const COLUMNS = 3
const TILE_GAP = 4
const THUMB_SLOP = 2
const TOOLBAR_HEIGHT = 36
const STAGE_HEIGHT = 261
/** Where the frame starts in the viewer: under the toolbar and its 12 gap. */
const FRAME_TOP = TOOLBAR_HEIGHT + space[3]
/** The art is drawn on a 179 square. */
const ART_SIZE = 179

type Tone = 'deep' | 'paper'
/** left, top, width, height on the 179 tile of the design. */
type Shape = ['circle' | 'center' | 'oval' | 'bar' | 'reed' | 'block' | 'rect', number, number, number, number, (Tone | undefined)?]

const WAVES: Shape[] = [[27, 111, 125], [36, 121, 107], [45, 132, 89], [54, 143, 71], [63, 154, 54]].map(([l = 0, t = 0, w = 0]) => ['bar', l, t, w, 3])
const ART: Shape[][] = [
  [['circle', 107, 32, 61, 61], ...WAVES],
  [['circle', 36, 29, 36, 36], ['oval', -36, 98, 250, 161], ['oval', 54, 129, 197, 125, 'deep']],
  [134, 107, 80, 54, 27].map((size, index): Shape => ['center', 0, (ART_SIZE - size) / 2, size, size, index % 2 ? 'paper' : undefined]),
  [27, 71, 116].flatMap((top, row) => [27, 71, 116].map((left, column): Shape => ['block', left, top, 36, 36, (row + column) % 2 ? undefined : 'deep'])),
  [...[[36, 98, 54], [54, 71, 80], [71, 45, 107], [89, 98, 54], [107, 71, 80], [125, 45, 107], [143, 98, 54]].map(([l = 0, t = 0, h = 0]): Shape => ['reed', l, t, 3, h]), ['rect', 0, 152, 179, 27]],
  [['center', 0, 45, 89, 89, 'deep'], ['rect', 0, 89, 179, 89]],
]

function ArtShape({ shape }: { shape: Shape }) {
  const colors = useColors()
  const [kind, left, top, width, height, tone] = shape
  const fill = tone === 'paper' ? colors.muted : colors.textPrimary
  const opacity = tone === 'deep' ? 0.6 : 1
  const paint = { fill, opacity }
  if (kind === 'circle') return <Circle cx={left + width / 2} cy={top + height / 2} r={width / 2} {...paint} />
  if (kind === 'center') return <Circle cx={ART_SIZE / 2} cy={top + height / 2} r={width / 2} {...paint} />
  if (kind === 'oval') return <Ellipse cx={left + width / 2} cy={top + height / 2} rx={width / 2} ry={height / 2} {...paint} />
  const rx = kind === 'block' ? width * 0.12 : kind === 'rect' ? 0 : 1
  return <Rect x={left} y={top} width={width} height={height} rx={rx} {...paint} />
}

/** One of the six stand-in photos. */
export function LightboxArt({ art }: { art: number }) {
  const styles = useThemed(createStyles)
  return (
    <View style={styles.art} aria-hidden>
      <Svg aria-hidden width="100%" height="100%" viewBox={`0 0 ${ART_SIZE} ${ART_SIZE}`} preserveAspectRatio="xMidYMid slice">
        {ART[art % ART.length]?.map((shape, index) => <ArtShape key={index} shape={shape} />)}
      </Svg>
    </View>
  )
}

export type LightboxPhoto = {
  /** The image. Leave it out to show the stand-in art. */
  src?: string
  /** Which stand-in art, from 0. */
  art?: number
  alt: string
  caption: string
  meta: string
}

export type LightboxState = 'grid' | 'open' | 'dismissing'

export type LightboxGridProps = {
  title?: string
  photos?: LightboxPhoto[]
  state?: LightboxState
  /** Default `grid`. */
  defaultState?: LightboxState
  onStateChange?: (state: LightboxState) => void
  /** The photo in the viewer. */
  index?: number
  defaultIndex?: number
  onIndexChange?: (index: number) => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const CAPTIONS: [string, string][] = [['Lake shore, early morning', 'Oct 12 · 06:42'], ['Moon over the ridge', 'Oct 12 · 05:58'], ['Trail marker', 'Oct 12 · 09:15'], ['Field station windows', 'Oct 12 · 11:30'], ['Reeds at the inlet', 'Oct 12 · 14:02'], ['Sun on the flats', 'Oct 12 · 18:47']]
const PHOTOS: LightboxPhoto[] = CAPTIONS.map(([caption, meta], art) => ({ art, alt: caption, caption, meta }))

function Picture({ photo }: { photo: LightboxPhoto | undefined }) {
  const styles = useThemed(createStyles)
  return photo?.src ? <Image source={{ uri: photo.src }} accessibilityLabel={photo.alt} resizeMode="cover" style={styles.image} /> : <LightboxArt art={photo?.art ?? 0} />
}

type Offset = { x: number; y: number; scaleX: number; scaleY: number }

/** A photo grid that opens into a viewer. The photo zooms out of its tile and returns to it. */
export function LightboxGrid({ title = 'Field trip', photos = PHOTOS, state, defaultState = 'grid', onStateChange, index, defaultIndex = 0, onIndexChange, renderIcon, animated = true, style }: LightboxGridProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [heldState, setHeldState] = useState(defaultState)
  const [heldIndex, setHeldIndex] = useState(defaultIndex)
  const [zoomed, setZoomed] = useState(false)
  const view = state ?? heldState
  const current = index ?? heldIndex
  const photo = photos[current]
  const held = view === 'dismissing'

  /** The grid's box in the root, from layout. */
  const grid = useRef<{ y: number; width: number } | null>(null)
  /** Where the photo came from, relative to the frame's resting box. */
  const origin = useRef<Offset | null>(null)

  const frameX = useSharedValue(0)
  const frameY = useSharedValue(0)
  const frameScaleX = useSharedValue(1)
  const frameScaleY = useSharedValue(1)
  const stageY = useSharedValue(0)
  const zoom = useSharedValue(1)
  const dim = useSharedValue(1)

  function setView(next: LightboxState): void {
    setHeldState(next)
    onStateChange?.(next)
  }

  function go(next: number): void {
    const wrapped = (next + photos.length) % photos.length
    setHeldIndex(wrapped)
    setZoomed(false)
    onIndexChange?.(wrapped)
  }

  /** Tiles sit on an even grid, so the box is known before the viewer mounts and nothing has to be measured late. */
  function offsetFor(at: number): Offset | null {
    const box = grid.current
    if (!box) return null
    const cell = box.width / COLUMNS
    const size = cell - TILE_GAP
    const frameWidth = box.width - TILE_GAP
    const left = (at % COLUMNS) * cell
    const top = box.y + Math.floor(at / COLUMNS) * cell + TILE_GAP / 2
    return { x: left + size / 2 - frameWidth / 2, y: top + size / 2 - (FRAME_TOP + STAGE_HEIGHT / 2), scaleX: size / frameWidth, scaleY: size / STAGE_HEIGHT }
  }

  function open(at: number): void {
    const from = offsetFor(at)
    origin.current = from
    setHeldIndex(at)
    onIndexChange?.(at)
    setZoomed(false)
    setView('open')
    if (still || !from) return
    frameX.value = from.x
    frameY.value = from.y
    frameScaleX.value = from.scaleX
    frameScaleY.value = from.scaleY
    frameX.value = withSpring(0, ZOOM)
    frameY.value = withSpring(0, ZOOM)
    frameScaleX.value = withSpring(1, ZOOM)
    frameScaleY.value = withSpring(1, ZOOM)
  }

  function finishDismiss(): void {
    setView('grid')
    // A parent that holds `state` may keep the viewer open.
    frameX.value = 0
    frameY.value = 0
    frameScaleX.value = 1
    frameScaleY.value = 1
  }

  function dismiss(): void {
    if (view !== 'open') return
    setZoomed(false)
    if (still) { setView('grid'); return }
    setView('dismissing')
    const to = origin.current
    frameScaleX.value = withSequence(withTiming(DISMISS_SCALE, DISMISS_STEP), withTiming(to?.scaleX ?? DISMISS_SCALE, DISMISS_STEP))
    frameScaleY.value = withSequence(withTiming(DISMISS_SCALE, DISMISS_STEP), withTiming(to?.scaleY ?? DISMISS_SCALE, DISMISS_STEP))
    frameX.value = withDelay(DISMISS_STEP_MS, withTiming(to?.x ?? 0, DISMISS_STEP))
    frameY.value = withDelay(DISMISS_STEP_MS, withTiming(to?.y ?? 0, DISMISS_STEP, (finished) => { if (finished) runOnJS(finishDismiss)() }))
  }

  const dismissRef = useRef(dismiss)
  dismissRef.current = dismiss
  const requestDismiss = useCallback(() => dismissRef.current(), [])

  // The hardware back button closes the viewer on Android, in place of Escape. There is no back button on the web.
  useEffect(() => {
    if (view !== 'open' || Platform.OS === 'web') return undefined
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { requestDismiss(); return true })
    return () => listener.remove()
  }, [requestDismiss, view])

  useEffect(() => {
    zoom.value = still ? (zoomed ? ZOOMED_SCALE : 1) : withTiming(zoomed ? ZOOMED_SCALE : 1, DIM)
  }, [still, zoom, zoomed])

  useEffect(() => {
    dim.value = held && !still ? withTiming(0.6, DIM) : held ? 0.6 : 1
  }, [dim, held, still])

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!still && !zoomed && !held)
    .activeOffsetY([-8, 8])
    .failOffsetX([-16, 16])
    .onUpdate((event) => { stageY.value = event.translationY * SWIPE_ELASTIC })
    .onEnd((event) => {
      stageY.value = withSpring(0, ZOOM)
      if (event.translationY > SWIPE_CLOSE) runOnJS(requestDismiss)()
    }), [held, requestDismiss, stageY, still, zoomed])

  const rootStyle = useAnimatedStyle(() => ({ opacity: dim.value }))
  const stageStyle = useAnimatedStyle(() => ({ transform: [{ translateY: stageY.value }] }))
  const frameStyle = useAnimatedStyle(() => ({ transform: [{ translateX: frameX.value }, { translateY: frameY.value }, { scaleX: frameScaleX.value }, { scaleY: frameScaleY.value }] }))
  const zoomStyle = useAnimatedStyle(() => ({ transform: [{ scale: zoom.value }] }))
  const fade = still ? {} : { entering: fadeIn }

  return (
    <Card animated={animated} style={[styles.lightbox, style]} bodyStyle={styles.body}>
      <Animated.View style={rootStyle}>
        {view === 'grid' ? (
          <Animated.View {...fade} style={styles.stack}>
            <View style={styles.header}>
              <Text style={styles.title} accessibilityRole="header">{title}</Text>
              <Text style={styles.meta}>{photos.length} photos</Text>
            </View>
            <View style={styles.grid} onLayout={(event) => { grid.current = { y: event.nativeEvent.layout.y, width: event.nativeEvent.layout.width } }}>
              {photos.map((item, at) => (
                <View key={item.caption} style={styles.cell}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.alt}`} style={styles.tile} onPress={() => open(at)}>
                    <Picture photo={item} />
                  </Pressable>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : (
          <View
            accessibilityViewIsModal
            accessibilityLabel={`${title}: photo ${current + 1} of ${photos.length}`}
            onAccessibilityEscape={requestDismiss}
            style={styles.stack}
          >
            <Animated.View {...fade} style={styles.toolbar}>
              <Text style={styles.counter}>{current + 1} / {photos.length}</Text>
              <View style={styles.actions}>
                <IconButton size="sm" variant="ghost" icon={renderIcon(zoomed ? 'zoom-out' : 'zoom-in', 16)} label={zoomed ? 'Zoom out' : 'Zoom in'} {...pressedState(zoomed)} animated={animated} onPress={() => setZoomed(!zoomed)} />
                <IconButton size="sm" variant="ghost" icon={renderIcon('x', 16)} label="Close" animated={animated} onPress={dismiss} />
              </View>
            </Animated.View>
            <GestureDetector gesture={pan}>
              <Animated.View style={[styles.stage, stageStyle]}>
                <View style={[styles.frameBox, state === 'dismissing' && styles.framePose]}>
                  <Animated.View style={[styles.frame, frameStyle]}>
                    <Animated.View style={[styles.layer, zoomStyle]}>
                      <LayoutAnimationConfig skipEntering>
                        <Animated.View key={current} {...(still ? {} : { entering: fadeIn, exiting: fadeOut })} style={styles.layer}>
                          <Picture photo={photo} />
                        </Animated.View>
                      </LayoutAnimationConfig>
                    </Animated.View>
                  </Animated.View>
                </View>
                <IconButton style={styles.previous} size="sm" variant="secondary" icon={renderIcon('arrow-left', 16)} label="Previous photo" animated={animated} onPress={() => go(current - 1)} />
                <IconButton style={styles.next} size="sm" variant="secondary" icon={renderIcon('arrow-right', 16)} label="Next photo" animated={animated} onPress={() => go(current + 1)} />
              </Animated.View>
            </GestureDetector>
            <Animated.View {...fade} accessibilityLiveRegion="polite" style={styles.caption}>
              <Text style={styles.captionText} numberOfLines={1}>{photo?.caption}</Text>
              <Text style={styles.meta}>{photo?.meta}</Text>
            </Animated.View>
            <Animated.View {...fade} style={styles.thumbs}>
              {photos.map((item, at) => (
                <Pressable key={item.caption} accessibilityRole="button" accessibilityLabel={item.alt} {...pressedState(at === current)} hitSlop={THUMB_SLOP} style={styles.thumb} onPress={() => go(at)}>
                  <View style={styles.thumbArt}><Picture photo={item} /></View>
                  {at === current ? <View style={styles.thumbRing} /> : null}
                </Pressable>
              ))}
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  lightbox: { maxWidth: 358, width: '100%' },
  body: { padding: space[3] },
  stack: { gap: space[3] },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[1], paddingTop: space[1] },
  title: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  meta: { ...type(12, c.textTertiary), flexShrink: 0 },
  // Half a gap on every side, so three cells fill the row.
  grid: { flexDirection: 'row', flexWrap: 'wrap', margin: -TILE_GAP / 2 },
  cell: { padding: TILE_GAP / 2, width: `${100 / COLUMNS}%` },
  tile: { aspectRatio: 1, borderRadius: radius.lg, overflow: 'hidden' },
  art: { backgroundColor: c.muted, flex: 1, overflow: 'hidden' },
  image: { height: '100%', width: '100%' },
  toolbar: { alignItems: 'center', flexDirection: 'row', height: TOOLBAR_HEIGHT, justifyContent: 'space-between' },
  counter: { color: c.textTertiary, fontFamily: font.mono, fontSize: 12 },
  actions: { flexDirection: 'row', gap: space[0.5] },
  stage: { height: STAGE_HEIGHT },
  frameBox: { ...StyleSheet.absoluteFill },
  framePose: { transform: [{ scale: DISMISS_SCALE }] },
  frame: { ...StyleSheet.absoluteFill, borderRadius: radius.control, overflow: 'hidden' },
  layer: { ...StyleSheet.absoluteFill },
  previous: { left: space[2.5], marginTop: -TOOLBAR_HEIGHT / 2, position: 'absolute', top: '50%' },
  next: { marginTop: -TOOLBAR_HEIGHT / 2, position: 'absolute', right: space[2.5], top: '50%' },
  caption: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingHorizontal: space[1] },
  captionText: { ...type(14, c.textPrimary, '500'), flexShrink: 1 },
  thumbs: { flexDirection: 'row', gap: space[1.5] },
  thumb: { height: 40, width: 40 },
  thumbArt: { borderRadius: radius.lg, flex: 1, overflow: 'hidden' },
  thumbRing: { borderColor: c.textPrimary, borderRadius: radius.xl, borderWidth: 1.5, bottom: -3, left: -3, position: 'absolute', right: -3, top: -3 },
})
