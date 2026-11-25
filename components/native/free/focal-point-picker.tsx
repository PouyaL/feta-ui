import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle, type ImageStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { FadeIn, FadeOut, runOnJS } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const KEY_STEP = 1
const SAVED_HOLD_MS = 1800
const POINT = 28
const CROPS = [{ name: 'Avatar', ratio: '1:1', value: 1 }, { name: 'Banner', ratio: '16:9', value: 16 / 9 }, { name: 'Story', ratio: '9:16', value: 9 / 16 }] as const

export type FocalPoint = { x: number; y: number }

export type FocalPointPickerProps = {
  src: string
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

type CropProps = { src: string; name: string; ratio: string; value: number; point: FocalPoint; photoRatio: number; onPeek: (on: boolean) => void }

function Crop({ src, name, ratio, value, point, photoRatio, onPeek }: CropProps) {
  const styles = useThemed(makeStyles)
  const [wide, setWide] = useState(0)
  const tall = wide / value
  const image = useMemo<ImageStyle>(() => {
    const scale = value > photoRatio ? wide / photoRatio : tall
    const width = scale * photoRatio
    const left = Math.min(0, Math.max(wide - width, wide / 2 - (point.x / 100) * width))
    const top = Math.min(0, Math.max(tall - scale, tall / 2 - (point.y / 100) * scale))
    return { position: 'absolute', width, height: scale, left, top }
  }, [wide, tall, value, photoRatio, point])
  const frame = useMemo<ViewStyle>(() => ({ aspectRatio: value }), [value])
  const slot = useMemo<ViewStyle>(() => ({ flex: value }), [value])
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name} crop, ${ratio}`} accessibilityHint="Hold to see this crop on the photo" onPressIn={() => onPeek(true)} onPressOut={() => onPeek(false)} style={[styles.crop, slot]}>
      <View onLayout={(e) => setWide(e.nativeEvent.layout.width)} style={[styles.cropFrame, frame]}>
        <Image source={{ uri: src }} style={image} />
      </View>
      <Text style={styles.cropName} numberOfLines={1}>{name} <Text style={styles.cropRatio}>{ratio}</Text></Text>
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

  const photoRatio = box.width / box.height
  const crop = useMemo<ViewStyle | null>(() => {
    if (peek === null) return null
    const ratio = CROPS[peek]?.value ?? 1
    const width = ratio < photoRatio ? (ratio / photoRatio) * 100 : 100
    const height = ratio < photoRatio ? 100 : (photoRatio / ratio) * 100
    return { left: `${Math.min(100 - width, Math.max(0, point.x - width / 2))}%`, top: `${Math.min(100 - height, Math.max(0, point.y - height / 2))}%`, width: `${width}%`, height: `${height}%` }
  }, [peek, photoRatio, point])
  const px = (point.x / 100) * box.width
  const py = (point.y / 100) * box.height
  const marks = useMemo(() => ({ x: { left: px }, y: { top: py }, dot: { left: px - POINT / 2, top: py - POINT / 2 } }), [px, py])

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.body}>
        <GestureDetector gesture={pan}>
          <View onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })} style={styles.photo}>
            <Image source={{ uri: src }} accessibilityLabel={alt} resizeMode="cover" style={styles.image} />
            {crop ? <View style={[styles.window, crop]} /> : null}
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
            />
            {dragging ? <View style={styles.chip}><Text style={styles.chipText}>{point.x}%  {point.y}%</Text></View> : null}
            {saved ? <Animated.View {...(still ? {} : { entering: FadeIn, exiting: FadeOut })} accessibilityLiveRegion="polite" style={styles.saved}><Text style={styles.chipText}>Saved</Text></Animated.View> : null}
          </View>
        </GestureDetector>
        <View style={styles.crops}>
          {CROPS.map((option, i) => <Crop key={option.name} src={src} name={option.name} ratio={option.ratio} value={option.value} point={point} photoRatio={photoRatio} onPeek={(on) => setPeek(on ? i : null)} />)}
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>{saved ? 'Every crop keeps this point' : 'Drag the point, or hold a crop'}</Text>
        <Text style={styles.mono}>{point.x}%  {point.y}%</Text>
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  body: { gap: space[3], padding: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  photo: { aspectRatio: 3 / 2, overflow: 'hidden', borderRadius: radius.xl, backgroundColor: c.ink5 },
  image: { width: '100%', height: '100%' },
  window: { position: 'absolute', borderWidth: 2, borderColor: c.surface },
  hairX: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: c.surface },
  hairY: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: c.surface },
  point: { position: 'absolute', width: POINT, height: POINT, borderRadius: radius.full, borderWidth: 2, borderColor: c.surface, backgroundColor: c.ink10 },
  chip: { position: 'absolute', top: space[2], left: space[2], paddingVertical: space[0.5], paddingHorizontal: space[1.5], borderRadius: radius.md, backgroundColor: c.inverse },
  saved: { position: 'absolute', right: space[2], bottom: space[2], paddingVertical: space[0.5], paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: c.inverse },
  chipText: type(11, c.textInverse, '400', true),
  crops: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  crop: { minHeight: 44, gap: space[1] },
  cropFrame: { width: '100%', overflow: 'hidden', borderRadius: radius.lg, backgroundColor: c.ink5 },
  cropName: type(12, c.textPrimary, '500'),
  cropRatio: { color: c.textTertiary, fontWeight: '400' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[2], paddingHorizontal: space[3] },
  footerText: { ...type(12, c.textSecondary), flexShrink: 1 },
  mono: type(12, c.textTertiary, '400', true),
})
