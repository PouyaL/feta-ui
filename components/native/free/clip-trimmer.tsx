import { useEffect, useMemo, useRef, useState } from 'react'
import { Image, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

const FRAMES = 10
const MIN_CLIP_S = 1
const SNAP_POINTS = 5
const STEP_S = 0.1
const HANDLE_HIT = 44
const STRIP_HEIGHT = 56

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`

export type ClipRange = { start: number; end: number }

export type ClipTrimmerProps = {
  /** A still of the clip. Each filmstrip frame shows a slice of it. */
  src: string
  alt: string
  /** Clip length in seconds. */
  duration: number
  defaultStart?: number
  defaultEnd?: number
  onChange?: (range: ClipRange) => void
  /** Renders the export and reports 0 to 1. */
  onExport: (range: ClipRange, report: (progress: number) => void) => Promise<void>
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Edge = 'start' | 'end'

/** Keep part of a clip. An ink range over a filmstrip, handles that snap to whole seconds. */
export function ClipTrimmer({ src, alt, duration, defaultStart = 0, defaultEnd, onChange, onExport, renderIcon, animated = true, style }: ClipTrimmerProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [wide, setWide] = useState(1)
  const [range, setRange] = useState<ClipRange>({ start: defaultStart, end: defaultEnd ?? duration })
  const [active, setActive] = useState<Edge | null>(null)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const clip = useRef(range)
  clip.current = range
  const full = range.start === 0 && range.end === duration
  const at = (seconds: number): number => (seconds / duration) * wide
  const head = useSharedValue(0)

  useEffect(() => {
    cancelAnimation(head)
    if (!playing) return undefined
    const from = at(range.start)
    const span = (range.end - range.start) * 1000
    head.value = from
    const run = withTiming(at(range.end), { duration: span, easing: Easing.linear }, (done) => { if (done && still) runOnJS(setPlaying)(false) })
    head.value = still ? run : withRepeat(run, -1, false)
    return () => cancelAnimation(head)
    // Playback restarts when the range or the strip changes.
  }, [playing, range.start, range.end, wide, still]) // eslint-disable-line react-hooks/exhaustive-deps

  function move(edge: Edge, seconds: number): void {
    const now = clip.current
    const next = edge === 'start' ? { ...now, start: Math.max(0, Math.min(seconds, now.end - MIN_CLIP_S)) } : { ...now, end: Math.min(duration, Math.max(seconds, now.start + MIN_CLIP_S)) }
    clip.current = next
    setRange(next)
    onChange?.(next)
  }

  function dragTo(edge: Edge, x: number): void {
    const seconds = (x / wide) * duration
    const whole = Math.round(seconds)
    move(edge, Math.abs(whole - seconds) * (wide / duration) <= SNAP_POINTS ? whole : seconds)
  }

  function step(edge: Edge, by: number): void {
    move(edge, Math.round((clip.current[edge] + by) * 10) / 10)
  }

  async function run(): Promise<void> {
    setPlaying(false)
    setExporting(true)
    setProgress(0)
    try {
      await onExport(range, setProgress)
    } finally {
      setExporting(false)
    }
  }

  const grab = (edge: Edge) => {
    const startX = at(range[edge])
    return Gesture.Pan()
      .minDistance(0)
      .onBegin(() => { runOnJS(setActive)(edge) })
      .onUpdate((e) => { runOnJS(dragTo)(edge, startX + e.translationX) })
      .onFinalize(() => { runOnJS(setActive)(null) })
  }

  const handle = (edge: Edge) => (
    <GestureDetector gesture={grab(edge)}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={edge === 'start' ? 'Clip start' : 'Clip end'}
        aria-valuetext={clock(range[edge])}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(edge, e.nativeEvent.actionName === 'increment' ? STEP_S : -STEP_S)}
        style={[styles.hit, leftOf(at(range[edge]) - HANDLE_HIT / 2)]}
      >
        <View style={[styles.handle, active === edge ? styles.handleActive : null]} />
      </View>
    </GestureDetector>
  )

  const playhead = useAnimatedStyle(() => ({ transform: [{ translateX: head.value }] }))
  const percent = (seconds: number): DimensionValue => `${(seconds / duration) * 100}%`
  const frameWide = wide / FRAMES
  const slice = useMemo(() => Array.from({ length: FRAMES }, (_, i) => ({ position: 'absolute' as const, width: wide, height: STRIP_HEIGHT, left: -i * frameWide })), [wide, frameWide])
  const cuts = useMemo(() => ({ before: { left: 0, width: percent(range.start) }, after: { left: percent(range.end), right: 0 }, keep: { left: percent(range.start), width: percent(range.end - range.start) } }), [range, duration]) // eslint-disable-line react-hooks/exhaustive-deps
  const fill = useMemo(() => ({ width: `${progress * 100}%` as DimensionValue }), [progress])

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.body}>
        <View style={styles.preview}>
          <Image source={{ uri: src }} accessibilityLabel={alt} resizeMode="cover" style={styles.image} />
          <View style={styles.disc}>
            <IconButton variant="ghost" size="md" icon={renderIcon(playing ? 'pause' : 'play', 16)} label={playing ? 'Pause' : 'Play'} animated={animated} onPress={() => setPlaying(!playing)} />
          </View>
          <View style={styles.clock}><Text style={styles.clockText}>{exporting ? `Exporting ${Math.round(progress * 100)}%` : clock(range[active ?? 'start'])}</Text></View>
        </View>
        <View onLayout={(e) => setWide(e.nativeEvent.layout.width)} style={styles.strip}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.frames}>
            {slice.map((image, i) => <View key={i} style={styles.frame}><Image source={{ uri: src }} resizeMode="cover" style={image} /></View>)}
          </View>
          <View style={[styles.cut, cuts.before]} />
          <View style={[styles.cut, cuts.after]} />
          <View style={[styles.range, cuts.keep]}>{exporting ? <View style={[styles.fill, fill]} /> : null}</View>
          {playing ? <Animated.View style={[styles.playhead, playhead]} /> : null}
          {handle('start')}
          {handle('end')}
        </View>
        <View style={styles.ruler} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.rulerText}>0s</Text><Text style={styles.rulerText}>{duration / 2}s</Text><Text style={styles.rulerText}>{duration}s</Text>
        </View>
      </View>
      <View style={styles.controls}>
        <Text accessibilityLiveRegion="polite" style={styles.length}><Text style={styles.strong}>{(range.end - range.start).toFixed(1)}s</Text> of {duration.toFixed(1)}s</Text>
        <Button variant="ghost" shape="pill" size="sm" animated={animated} disabled={full || exporting} leadingIcon={renderIcon('rotate-ccw', 16)} onPress={() => { const next = { start: 0, end: duration }; setRange(next); onChange?.(next) }}>Reset</Button>
        <Button shape="pill" size="sm" animated={animated} disabled={full && !exporting} status={exporting ? 'loading' : 'idle'} loadingLabel="Exporting" onPress={() => { void run() }}>Export</Button>
      </View>
    </View>
  )
}

const leftOf = (left: number): ViewStyle => ({ left })

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  body: { gap: space[2], padding: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  preview: { aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radius.xl, backgroundColor: c.ink5 },
  image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  disc: { borderRadius: radius.full, backgroundColor: c.surface },
  clock: { position: 'absolute', right: space[2], bottom: space[2], paddingVertical: space[0.5], paddingHorizontal: space[1.5], borderRadius: radius.md, backgroundColor: c.inverse },
  clockText: type(11, c.textInverse, '400', true),
  strip: { height: STRIP_HEIGHT },
  frames: { ...StyleSheet.absoluteFill, flexDirection: 'row', overflow: 'hidden', borderRadius: radius.md },
  frame: { flex: 1, overflow: 'hidden' },
  cut: { position: 'absolute', top: 0, bottom: 0, backgroundColor: c.surface, opacity: 0.7 },
  range: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden', borderTopWidth: 2, borderBottomWidth: 2, borderColor: c.textPrimary },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: c.ink10 },
  playhead: { position: 'absolute', top: -space[0.5], bottom: -space[0.5], left: 0, width: 2, backgroundColor: c.textPrimary },
  hit: { position: 'absolute', top: 0, bottom: 0, width: HANDLE_HIT, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 8, height: '100%', borderRadius: radius.xs, backgroundColor: c.textPrimary },
  handleActive: { width: 10 },
  ruler: { flexDirection: 'row', justifyContent: 'space-between' },
  rulerText: type(11, c.textTertiary, '400', true),
  controls: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[2], paddingLeft: space[3], paddingRight: space[1] },
  length: { ...type(12, c.textSecondary), flex: 1 },
  strong: { fontWeight: '500', color: c.textPrimary },
})
