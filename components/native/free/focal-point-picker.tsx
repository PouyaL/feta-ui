import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeOut, runOnJS } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const KEY_STEP = 1
const SAVED_HOLD_MS = 1800
const POINT = 28
const POINT_DRAG = 40
/** The photo is 200 tall on a phone and each crop at most 84, like the web's Mobile layout. */
const PHOTO_HEIGHT = 200
const CROP_MAX = 84
const SCENE_RATIO = 16 / 9
const DIM = 'rgba(0,0,0,0.45)'
const CENTRE = { x: 50, y: 50 }
const CROPS = [{ name: 'Avatar', ratio: '1:1', value: 1 }, { name: 'Banner', ratio: '16:9', value: 16 / 9 }, { name: 'Story', ratio: '9:16', value: 9 / 16 }] as const

export type FocalPoint = { x: number; y: number }

export type FocalPointPickerProps = {
  /** The photo. Leave it out to draw the sample valley scene. */
  src?: string
  alt: string
  /** Percent, 0 to 100. */
  defaultPoint?: FocalPoint
  onChange?: (point: FocalPoint) => void
  /** Fires when a drag ends. Shows the saved chip. */
  onSave?: (point: FocalPoint) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const clamp = (value: number): number => Math.min(100, Math.max(0, value))

/** The sample photo the docs use: a valley at dusk, drawn with SVG so it needs no image file. */
function ValleyScene({ width, height }: { width: number; height: number }) {
  const sky = `focalSky${useId().replace(/:/g, '')}`
  return (
    <Svg aria-hidden width={width} height={height} viewBox="0 0 640 360" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4f6bff" />
          <Stop offset="0.62" stopColor="#ffb37a" />
        </LinearGradient>
      </Defs>
      <Rect width={640} height={360} fill={`url(#${sky})`} />
      <Circle cx={440} cy={150} r={48} fill="#fff3d6" />
      <Path d="M0 230 140 110l100 90 90-70 150 120 160-90v200H0Z" fill="#3f3f6b" />
      <Path d="M0 290c120-50 260-30 360 0s200 20 280-20v90H0Z" fill="#20203f" />
    </Svg>
  )
}

/**
 * The photo in a frame, cropped like CSS `object-fit: cover` and placed so the point sits as near the middle as the
 * edges allow, like `object-position`.
 */
function Cover({ src, width, height, ratio, point, label }: { src: string | undefined; width: number; height: number; ratio: number; point: FocalPoint; label?: string }) {
  const fit = width / height > ratio ? { w: width, h: width / ratio } : { w: height * ratio, h: height }
  const left = (width - fit.w) * (point.x / 100)
  const top = (height - fit.h) * (point.y / 100)
  const place = { position: 'absolute' as const, left, top, width: fit.w, height: fit.h }
  return src
    ? <Image source={{ uri: src }} accessibilityLabel={label} resizeMode="stretch" style={place} />
    : <View style={place}><ValleyScene width={fit.w} height={fit.h} /></View>
}

type CropProps = { src: string | undefined; name: string; ratio: string; value: number; point: FocalPoint; photoRatio: number; on: boolean; onPeek: (on: boolean) => void }

function Crop({ src, name, ratio, value, point, photoRatio, on, onPeek }: CropProps) {
  const styles = useThemed(makeStyles)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const frame = useMemo<ViewStyle>(() => ({ aspectRatio: value }), [value])
  const slot = useMemo<ViewStyle>(() => ({ flex: value }), [value])
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name} crop, ${ratio}`} accessibilityHint="Hold to see this crop on the photo" onPressIn={() => onPeek(true)} onPressOut={() => onPeek(false)} style={[styles.crop, slot]}>
      <View onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })} style={[styles.cropFrame, frame, on && styles.cropOn]}>
        {size.width ? <Cover src={src} width={size.width} height={size.height} ratio={photoRatio} point={point} /> : null}
      </View>
      <Text style={styles.cropLabel} numberOfLines={1}><Text style={[styles.cropName, on && styles.cropNameOn]}>{name}</Text> <Text style={styles.cropRatio}>{ratio}</Text></Text>
    </Pressable>
  )
}

/** Sets the point every crop keeps. Each crop centres on it as far as its edges allow. */
export function FocalPointPicker({ src, alt, defaultPoint = { x: 68, y: 38 }, onChange, onSave, animated = true, style }: FocalPointPickerProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [point, setPoint] = useState(defaultPoint)
  const [dragging, setDragging] = useState(false)
  const [saved, setSaved] = useState(false)
  const [peek, setPeek] = useState<number | null>(null)
  const [box, setBox] = useState({ width: 1, height: 1 })
  useEffect(() => () => clearTimeout(timer.current), [])

  function place(x: number, y: number): FocalPoint {
    const next = { x: Math.round(clamp((x / box.width) * 100)), y: Math.round(clamp((y / box.height) * 100)) }
    setPoint(next)
    onChange?.(next)
    return next
  }

  function save(next: FocalPoint): void {
    setSaved(true)
    onSave?.(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSaved(false), SAVED_HOLD_MS)
  }

  function start(x: number, y: number): void {
    setDragging(true)
    setSaved(false)
    place(x, y)
  }

  function finish(x: number, y: number): void {
    setDragging(false)
    save(place(x, y))
  }

  function nudge(dx: number, dy: number): void {
    const next = { x: clamp(point.x + dx), y: clamp(point.y + dy) }
    setPoint(next)
    onChange?.(next)
    save(next)
  }

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => { runOnJS(start)(e.x, e.y) })
    .onUpdate((e) => { runOnJS(place)(e.x, e.y) })
    .onEnd((e) => { runOnJS(finish)(e.x, e.y) })

  // Crops show the photo as it is drawn in the frame, so they share its aspect.
  const photoRatio = src ? box.width / box.height : SCENE_RATIO
  // The dim outside a held crop: one frame whose borders are the four panes, as React Native has no spread shadow.
  const dim = useMemo<ViewStyle | null>(() => {
    if (peek === null) return null
    const ratio = CROPS[peek]?.value ?? 1
    const frame = box.width / box.height
    const width = ratio < frame ? (ratio / frame) * box.width : box.width
    const height = ratio < frame ? box.height : (frame / ratio) * box.height
    const left = Math.min(box.width - width, Math.max(0, (point.x / 100) * box.width - width / 2))
    const top = Math.min(box.height - height, Math.max(0, (point.y / 100) * box.height - height / 2))
    return { borderTopWidth: top, borderLeftWidth: left, borderBottomWidth: box.height - top - height, borderRightWidth: box.width - left - width }
  }, [peek, box, point])
  const px = (point.x / 100) * box.width
  const py = (point.y / 100) * box.height
  const cross = dragging ? POINT_DRAG : POINT
  const marks = useMemo(() => ({ x: { left: px }, y: { top: py }, dot: { left: px - cross / 2, top: py - cross / 2, width: cross, height: cross } }), [px, py, cross])

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.body}>
        <GestureDetector gesture={pan}>
          <View onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })} style={styles.photo}>
            <View {...(alt ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: alt } : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })} style={StyleSheet.absoluteFill}>
              {src ? <Image source={{ uri: src }} resizeMode="cover" style={styles.image} /> : <Cover src={undefined} width={box.width} height={box.height} ratio={SCENE_RATIO} point={CENTRE} />}
            </View>
            {dim ? <Animated.View {...(still ? {} : { entering: FadeIn.duration(200) })} pointerEvents="none" style={[styles.dim, dim]} /> : null}
            <View style={[styles.hairX, marks.y]} />
            <View style={[styles.hairY, marks.x]} />
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Focal point"
              aria-valuetext={`${point.x}% across, ${point.y}% down`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={point.x}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? KEY_STEP : -KEY_STEP, 0)}
              style={[styles.point, marks.dot]}
            >
              <View style={styles.pointDot} />
            </View>
            {dragging ? <View pointerEvents="none" style={[styles.chip, { left: px - 40, top: py - cross / 2 - 24 }]}><Text style={styles.chipText}>{point.x}%  {point.y}%</Text></View> : null}
            {saved ? <Animated.View {...(still ? {} : { entering: FadeIn, exiting: FadeOut })} accessibilityLiveRegion="polite" style={styles.saved}><Text style={styles.savedText}>Saved</Text></Animated.View> : null}
          </View>
        </GestureDetector>
        <View style={styles.crops}>
          {CROPS.map((option, i) => <Crop key={option.name} src={src} name={option.name} ratio={option.ratio} value={option.value} point={point} photoRatio={photoRatio} on={peek === i} onPeek={(on) => setPeek(on ? i : null)} />)}
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{saved ? 'Every crop keeps this point' : 'Drag the point, or hold a crop'}</Text>
        <Text style={styles.mono}>{point.x}%  {point.y}%</Text>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => {
  const successWash = c.canvas === '#ffffff' ? '#ecfdf5' : '#022c22'
  const successText = c.canvas === '#ffffff' ? '#047857' : '#6ee7b7'
  return StyleSheet.create({
    tray: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
    body: { gap: space[3], padding: space[2], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    photo: { height: PHOTO_HEIGHT, overflow: 'hidden', borderRadius: radius.control, backgroundColor: c.ink5 },
    image: { width: '100%', height: '100%' },
    dim: { ...StyleSheet.absoluteFill, borderColor: DIM },
    // Overlays on the photo are white, so they read on any image.
    hairX: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.6)' },
    hairY: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.6)' },
    point: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, borderWidth: 2, borderColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
    pointDot: { width: 11, height: 11, borderRadius: radius.full, borderWidth: 1.5, borderColor: '#ffffff', backgroundColor: c.inverse },
    chip: { position: 'absolute', width: 80, alignItems: 'center', paddingVertical: space[0.5], borderRadius: radius.md, backgroundColor: c.inverse },
    chipText: { ...type(10, c.textInverse, '400', true), lineHeight: 12 },
    saved: { position: 'absolute', top: space[2], left: space[2], paddingVertical: space[0.5], paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: successWash },
    savedText: { ...type(12, successText, '500'), lineHeight: 16 },
    // Each crop takes width in proportion to its ratio, so all three fit at one height.
    crops: { flexDirection: 'row', alignItems: 'flex-start', gap: space[1] },
    crop: { minWidth: 0, minHeight: 44 },
    cropFrame: { width: '100%', maxHeight: CROP_MAX, overflow: 'hidden', borderRadius: radius.field, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.ink5 },
    cropOn: { borderWidth: 2, borderColor: c.textPrimary },
    cropLabel: { marginTop: space[1.5] },
    cropName: { ...type(12, c.textPrimary, '500'), lineHeight: 16 },
    cropNameOn: { fontWeight: '600' },
    cropRatio: { ...type(10, c.textTertiary, '400', true), lineHeight: 12 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[2], paddingHorizontal: space[3] },
    footerText: { ...type(12, c.textSecondary), lineHeight: 16, flexShrink: 1 },
    mono: { ...type(12, c.textPrimary, '400', true), lineHeight: 16 },
  })
}
