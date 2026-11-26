import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Image, StyleSheet, Text, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Button, SELF } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

const FRAMES = 10
const MIN_CLIP_S = 1
const SNAP_POINTS = 5
const STEP_S = 0.1
const HANDLE_HIT = 44
const STRIP_HEIGHT = 52
const FRAME_INSET = 4
const SCENE_RATIO = 16 / 9

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`

export type ClipRange = { start: number; end: number }

export type ClipTrimmerProps = {
  /** A still of the clip. Each filmstrip frame shows a slice of it. Leave it out to draw the sample valley scene. */
  src?: string
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

/** The sample still the docs use: a valley at dusk, drawn with SVG so it needs no image file. */
function ValleyScene({ width, height }: { width: number; height: number }) {
  const sky = `clipSky${useId().replace(/:/g, '')}`
  return (
    <Svg aria-hidden width={width} height={height} viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
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

/** The still at a given size, cropped like CSS `cover`. */
function Still({ src, width, height, style }: { src: string | undefined; width: number; height: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ position: 'absolute', width, height }, style]}>{src ? <Image source={{ uri: src }} resizeMode="cover" style={{ width, height }} /> : <ValleyScene width={width} height={height} />}</View>
}

/** Keep part of a clip. An ink range over a filmstrip, handles that snap to whole seconds. */
export function ClipTrimmer({ src, alt, duration, defaultStart = 0, defaultEnd, onChange, onExport, renderIcon, animated = true, style }: ClipTrimmerProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [wide, setWide] = useState(1)
  const [frame, setFrame] = useState({ width: 1, height: 1 })
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
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={range[edge]}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => step(edge, e.nativeEvent.actionName === 'increment' ? STEP_S : -STEP_S)}
        style={[styles.hit, leftOf(at(range[edge]) - HANDLE_HIT / 2)]}
      >
        <View style={[styles.handle, active === edge ? styles.handleActive : null]}><View style={styles.grip} /></View>
      </View>
    </GestureDetector>
  )

  const playhead = useAnimatedStyle(() => ({ transform: [{ translateX: head.value }] }))
  const percent = (seconds: number): DimensionValue => `${(seconds / duration) * 100}%`
  // Each frame shows the still scaled to the strip height, panned left to right like `background-position: x% 50%`.
  const frameWide = wide / FRAMES
  const frameHigh = STRIP_HEIGHT - FRAME_INSET * 2
  const stillWide = Math.max(frameWide, frameHigh * SCENE_RATIO)
  const slice = useMemo(() => Array.from({ length: FRAMES }, (_, i) => ({ left: -((stillWide - frameWide) * i) / (FRAMES - 1) })), [stillWide, frameWide])
  const cuts = useMemo(() => ({ before: { left: 0, width: percent(range.start) }, after: { left: percent(range.end), right: 0 }, keep: { left: percent(range.start), width: percent(range.end - range.start) } }), [range, duration]) // eslint-disable-line react-hooks/exhaustive-deps
  const fill = useMemo(() => ({ width: `${progress * 100}%` as DimensionValue }), [progress])

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.body}>
        <View onLayout={(e) => setFrame({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })} style={styles.preview}>
          <View accessible accessibilityRole="image" accessibilityLabel={alt} style={StyleSheet.absoluteFill}><Still src={src} width={frame.width} height={frame.height} /></View>
          <View style={styles.disc}>
            <IconButton variant="ghost" size="md" icon={renderIcon(playing ? 'pause' : 'play', 16)} label={playing ? 'Pause' : 'Play'} animated={animated} onPress={() => setPlaying(!playing)} />
          </View>
          <Text style={styles.clock}>{exporting ? `Exporting ${Math.round(progress * 100)}%` : clock(range[active ?? 'start'])}</Text>
          {active ? <Text style={[styles.time, leftOf(at(range[active]) + space[2] - 30)]}>{clock(range[active])}</Text> : null}
        </View>
        <View onLayout={(e) => setWide(e.nativeEvent.layout.width)} style={styles.strip}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.frames}>
            {slice.map((pan, i) => <View key={i} style={[styles.frame, i === FRAMES - 1 ? styles.frameLast : null]}><Still src={src} width={stillWide} height={frameHigh} style={pan} /></View>)}
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
        <Button style={SELF.center} variant="ghost" shape="pill" size="sm" animated={animated} disabled={full || exporting} leadingIcon={renderIcon('rotate-ccw', 16)} onPress={() => { const next = { start: 0, end: duration }; setRange(next); onChange?.(next) }}>Reset</Button>
        <Button style={SELF.center} shape="pill" size="sm" animated={animated} disabled={full && !exporting} status={exporting ? 'loading' : 'idle'} loadingLabel="Exporting" onPress={() => { void run() }}>Export</Button>
      </View>
    </View>
  )
}

const leftOf = (left: number): ViewStyle => ({ left })

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', maxWidth: 480, alignSelf: 'center', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  body: { gap: space[3], padding: space[2], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  preview: { aspectRatio: 16 / 9, overflow: 'hidden', borderRadius: radius.control, backgroundColor: c.ink5 },
  // Play on a surface disc in the corner, so it never covers the footage.
  disc: { position: 'absolute', right: space[2], bottom: space[2], borderRadius: radius.full, backgroundColor: c.surface },
  clock: { position: 'absolute', left: space[2], bottom: space[2], ...type(12, c.onSolid, '400', true), lineHeight: 16, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  time: { position: 'absolute', bottom: 2, width: 60, textAlign: 'center', overflow: 'hidden', paddingVertical: space[0.5], borderRadius: radius.md, backgroundColor: c.inverse, ...type(10, c.textInverse, '400', true) },
  strip: { height: STRIP_HEIGHT, marginHorizontal: space[2] },
  frames: { position: 'absolute', top: FRAME_INSET, bottom: FRAME_INSET, left: 0, right: 0, flexDirection: 'row', overflow: 'hidden', borderRadius: radius.field },
  frame: { flex: 1, overflow: 'hidden', borderRightWidth: 1, borderRightColor: c.surface === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(24,24,27,0.4)' },
  frameLast: { borderRightWidth: 0 },
  cut: { position: 'absolute', top: FRAME_INSET, bottom: FRAME_INSET, backgroundColor: c.surface, opacity: 0.72 },
  range: { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden', borderWidth: 2, borderRadius: radius.field, borderColor: c.inverse },
  fill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: c.inverse, opacity: 0.4 },
  playhead: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, backgroundColor: c.onSolid, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 2, shadowOffset: { width: 0, height: 0 } },
  // The visual handle is 14 wide and sits 8 left of its time, like the web; the hit area around it is 44.
  hit: { position: 'absolute', top: 0, bottom: 0, width: HANDLE_HIT, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 14, height: '100%', marginLeft: -2, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: c.inverse },
  handleActive: { width: 16 },
  grip: { width: 2, height: STRIP_HEIGHT - 36, borderRadius: radius.full, backgroundColor: c.textInverse },
  ruler: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: space[2] },
  rulerText: { ...type(10, c.textTertiary, '400', true), lineHeight: 12 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space[1], paddingTop: space[2], paddingBottom: space[1], paddingLeft: space[3], paddingRight: space[2] },
  length: { ...type(12, c.textSecondary, '400', true), lineHeight: 16, flex: 1 },
  strong: { fontWeight: '500', color: c.textPrimary },
})
