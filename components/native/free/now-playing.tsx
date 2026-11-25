import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, Keyframe, LayoutAnimationConfig, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { font, pressedState, radius, space, useColors, type Colors } from '../kit'
import { useLoop, withInk } from './button'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
/** Play and pause: the icon morphs in 200 ms. */
const MORPH_MS = 200
const TICK_MS = 1000
const SEEK_STEP = 5
/** One up and one down of the equalizer. */
const EQ_MS = 1800
const EQ_STAGGER_MS = 220
const EQ_FLOOR = 0.25
const EQ_REST = [0.5, 1, 0.67, 0.83]
const WAVES = [0, 1, 2, 3, 4]
const RINGS = [0, 1, 2]

const morphIn = new Keyframe({ from: { opacity: 0, transform: [{ scale: 0.6 }] }, to: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT } }).duration(MORPH_MS)
const morphOut = new Keyframe({ from: { opacity: 1, transform: [{ scale: 1 }] }, to: { opacity: 0, transform: [{ scale: 0.6 }], easing: EASE_OUT } }).duration(MORPH_MS)

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export type NowPlayingTrack = {
  title: string
  artist: string
  /** Seconds. */
  length: number
  /** An image, or `<NowPlayingArt />`. */
  cover?: ReactNode
}

export type NowPlayingProps = {
  track: NowPlayingTrack
  playing?: boolean
  /** Default true. */
  defaultPlaying?: boolean
  onPlayingChange?: (playing: boolean) => void
  /** Seconds. Leave it out and the card keeps its own time while playing. */
  elapsed?: number
  /** Default 0. */
  defaultElapsed?: number
  onSeek?: (seconds: number) => void
  onNext?: () => void
  onPrevious?: () => void
  /** The one line mini player. */
  compact?: boolean
  onMore?: () => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** The stand-in covers. */
export function NowPlayingArt({ kind = 'tide' }: { kind?: 'tide' | 'bloom' }) {
  const styles = useThemed(createStyles)
  return (
    <View style={styles.art} aria-hidden>
      {kind === 'tide'
        ? <><View style={styles.sun} />{WAVES.map((wave) => <View key={wave} style={[styles.ripple, ripples[wave]]} />)}</>
        : RINGS.map((ring) => <View key={ring} style={[styles.ring, rings[ring], ring === RINGS.length - 1 && styles.ringLast]} />)}
    </View>
  )
}

function Bar({ index, tick, on, still }: { index: number; tick: SharedValue<number>; on: SharedValue<number>; still: boolean }) {
  const styles = useThemed(createStyles)
  const rest = EQ_REST[index] ?? 1
  const rise = useAnimatedStyle(() => {
    // A triangle wave eased at both ends, each bar 220 ms ahead of the last.
    const phase = ((tick.value * EQ_MS + index * EQ_STAGGER_MS) % EQ_MS) / (EQ_MS / 2)
    const up = phase <= 1 ? phase : 2 - phase
    const eased = (1 - Math.cos(Math.PI * up)) / 2
    const peak = still ? rest : EQ_FLOOR + (1 - EQ_FLOOR) * eased
    return { transform: [{ scaleY: EQ_FLOOR + (peak - EQ_FLOOR) * on.value }] }
  })
  return <Animated.View style={[styles.bar, rise]} />
}

function Equalizer({ playing, still }: { playing: boolean; still: boolean }) {
  const styles = useThemed(createStyles)
  const tick = useLoop(playing && !still, EQ_MS)
  const on = useSharedValue(playing ? 1 : 0)
  useEffect(() => {
    on.value = still ? (playing ? 1 : 0) : withTiming(playing ? 1 : 0, { duration: MORPH_MS, easing: EASE_OUT })
  }, [on, playing, still])
  return (
    <View style={styles.equalizer} aria-hidden>
      {EQ_REST.map((_, index) => <Bar key={index} index={index} tick={tick} on={on} still={still} />)}
    </View>
  )
}

/** `IconButton` inks its icon with `color`. This hands it on through the morph. */
function MorphIcon({ playing, still, renderIcon, color }: { playing: boolean; still: boolean; renderIcon: RenderIcon; color?: string }) {
  const icon = renderIcon(playing ? 'pause' : 'play', 20)
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View key={playing ? 'pause' : 'play'} {...(still ? {} : { entering: morphIn, exiting: morphOut })}>
        {color ? withInk(icon, color) : icon}
      </Animated.View>
    </LayoutAnimationConfig>
  )
}

type SeekBarProps = { time: number; length: number; seeking: boolean; still: boolean; onSeekingChange: (seeking: boolean) => void; onSeek: (seconds: number) => void }

/** A 4 tall rail in a 44 tall touch strip. Tap to jump, or drag along it. */
function SeekBar({ time, length, seeking, still, onSeekingChange, onSeek }: SeekBarProps) {
  const styles = useThemed(createStyles)
  const width = useSharedValue(0)
  const share = length ? time / length : 0
  const fill = useSharedValue(share)
  useEffect(() => {
    fill.value = seeking || still ? share : withTiming(share, { duration: TICK_MS, easing: Easing.linear })
  }, [fill, seeking, share, still])
  const fillStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: fill.value }] }))

  const pan = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      runOnJS(onSeekingChange)(true)
      runOnJS(onSeek)(Math.round(Math.max(0, Math.min(1, event.x / (width.value || 1))) * length))
    })
    .onUpdate((event) => { runOnJS(onSeek)(Math.round(Math.max(0, Math.min(1, event.x / (width.value || 1))) * length)) })
    .onFinalize(() => { runOnJS(onSeekingChange)(false) }), [length, onSeek, onSeekingChange, width])

  function handleAction({ nativeEvent }: AccessibilityActionEvent): void {
    if (nativeEvent.actionName === 'increment') onSeek(Math.min(length, time + SEEK_STEP))
    if (nativeEvent.actionName === 'decrement') onSeek(Math.max(0, time - SEEK_STEP))
  }

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Seek"
        aria-valuemin={0}
        aria-valuemax={length}
        aria-valuenow={time}
        aria-valuetext={`${clock(time)} of ${clock(length)}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={handleAction}
        onLayout={(event) => { width.value = event.nativeEvent.layout.width }}
        style={styles.seek}
      >
        <View style={styles.rail}><Animated.View style={[styles.fill, fillStyle]} /></View>
      </View>
    </GestureDetector>
  )
}

/** A music player on the Card tray, with a live progress bar and a compact mini player. */
export function NowPlaying({ track, playing, defaultPlaying = true, onPlayingChange, elapsed, defaultElapsed = 0, onSeek, onNext, onPrevious, compact = false, onMore, renderIcon, animated = true, style }: NowPlayingProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const colors = useColors()
  const [heldPlaying, setHeldPlaying] = useState(defaultPlaying)
  const [heldTime, setHeldTime] = useState(defaultElapsed)
  const [seeking, setSeeking] = useState(false)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const isPlaying = playing ?? heldPlaying
  const time = Math.min(elapsed ?? heldTime, track.length)

  function setPlaying(next: boolean): void {
    setHeldPlaying(next)
    onPlayingChange?.(next)
  }

  useEffect(() => {
    if (!isPlaying || seeking || elapsed !== undefined) return undefined
    const timer = setInterval(() => {
      setHeldTime((current) => Math.min(current + 1, track.length))
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [isPlaying, seeking, elapsed, track.length])

  useEffect(() => {
    if (time < track.length || !isPlaying || elapsed !== undefined) return
    setHeldPlaying(false)
    onPlayingChange?.(false)
  }, [time, track.length, isPlaying, elapsed, onPlayingChange])

  const seekTo = useCallback((next: number): void => {
    setHeldTime(next)
    onSeek?.(next)
  }, [onSeek])

  const toggle = (
    <IconButton
      size={compact ? 'sm' : 'lg'}
      animated={animated}
      label={isPlaying ? 'Pause' : 'Play'}
      onPress={() => setPlaying(!isPlaying)}
      icon={<MorphIcon playing={isPlaying} still={still} renderIcon={renderIcon} />}
    />
  )
  const cover = track.cover ?? <NowPlayingArt />

  if (compact) {
    return (
      <Card animated={animated} style={[styles.player, style]} bodyStyle={styles.compact}>
        <View style={styles.compactRow}>
          <View style={styles.coverSmall}>{cover}</View>
          <View style={styles.compactText}>
            <Text style={styles.compactTitle} numberOfLines={1}>{track.title}</Text>
            <View style={styles.compactSub}>
              <Equalizer playing={isPlaying} still={still} />
              <Text style={styles.subText} numberOfLines={1}>{track.artist} · {clock(time)}</Text>
            </View>
          </View>
          <IconButton size="sm" variant="ghost" icon={renderIcon('skip-forward', 16)} label="Next" animated={animated} onPress={onNext} />
          {toggle}
        </View>
      </Card>
    )
  }

  return (
    <Card animated={animated} style={[styles.player, style]}>
      <View style={styles.content}>
        <View style={styles.top}>
          <View style={styles.cover}>{cover}</View>
          <View style={styles.text}>
            <View style={styles.kicker}><Equalizer playing={isPlaying} still={still} /><Text style={styles.small}>{isPlaying ? 'Now playing' : 'Paused'}</Text></View>
            <Text style={styles.track} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.small} numberOfLines={1}>{track.artist}</Text>
          </View>
          <IconButton size="sm" variant="ghost" icon={renderIcon('more-horizontal', 16)} label="More" animated={animated} onPress={onMore} />
        </View>
        <View style={styles.progress}>
          <SeekBar time={time} length={track.length} seeking={seeking} still={still} onSeekingChange={setSeeking} onSeek={seekTo} />
          <View style={styles.times}><Text style={styles.timeNow}>{clock(time)}</Text><Text style={styles.timeEnd}>{clock(track.length)}</Text></View>
        </View>
        <View style={styles.controls}>
          <IconButton size="sm" variant="ghost" contentStyle={shuffle ? styles.toggleOn : undefined} icon={withInk(renderIcon('shuffle', 16), shuffle ? colors.textPrimary : colors.textSecondary)} label="Shuffle" {...pressedState(shuffle)} animated={animated} onPress={() => setShuffle(!shuffle)} />
          <View style={styles.main}>
            <IconButton variant="ghost" icon={renderIcon('skip-back', 20)} label="Previous" animated={animated} onPress={onPrevious} />
            {toggle}
            <IconButton variant="ghost" icon={renderIcon('skip-forward', 20)} label="Next" animated={animated} onPress={onNext} />
          </View>
          <IconButton size="sm" variant="ghost" contentStyle={repeat ? styles.toggleOn : undefined} icon={withInk(renderIcon('repeat', 16), repeat ? colors.textPrimary : colors.textSecondary)} label="Repeat" {...pressedState(repeat)} animated={animated} onPress={() => setRepeat(!repeat)} />
        </View>
      </View>
    </Card>
  )
}

const ripples = WAVES.map((wave) => ({ left: `${15 + wave * 5}%`, top: `${62 + wave * 6}%`, width: `${70 - wave * 10}%` } as const))
const rings = RINGS.map((ring) => {
  const inset = `${5 + ring * 15}%` as const
  return { bottom: inset, left: inset, right: inset, top: inset }
})

const createStyles = (c: Colors) => StyleSheet.create({
  player: { maxWidth: 358, width: '100%' },
  content: { gap: space[4] },
  top: { alignItems: 'center', flexDirection: 'row', gap: space[4] },
  cover: { borderRadius: radius['2xl'], flexShrink: 0, height: 88, overflow: 'hidden', width: 88 },
  coverSmall: { borderRadius: radius.field, flexShrink: 0, height: 44, overflow: 'hidden', width: 44 },
  text: { flex: 1, gap: space[1], minWidth: 0 },
  kicker: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  small: type(12, c.textSecondary),
  track: { ...type(18, c.textPrimary, '600'), lineHeight: 26 },
  equalizer: { alignItems: 'flex-end', flexDirection: 'row', flexShrink: 0, gap: space[0.5], height: 12, width: 14 },
  bar: { backgroundColor: c.textSecondary, borderRadius: radius.xs, height: 12, transformOrigin: 'bottom', width: 2 },
  progress: { gap: space[0.5] },
  seek: { height: 44, justifyContent: 'center', marginVertical: -space[4] },
  rail: { backgroundColor: c.ink8, borderRadius: radius.full, height: 4, overflow: 'hidden' },
  fill: { backgroundColor: c.inverse, height: 4, transformOrigin: 'left', width: '100%' },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space[1] },
  timeNow: { color: c.textSecondary, fontFamily: font.mono, fontSize: 12 },
  timeEnd: { color: c.textTertiary, fontFamily: font.mono, fontSize: 12 },
  controls: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  main: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  toggleOn: { backgroundColor: c.ink5 },
  compact: { padding: space[2] },
  compactRow: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
  compactText: { flex: 1, gap: space[0.5], minWidth: 0 },
  compactTitle: type(14, c.textPrimary, '500'),
  compactSub: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  subText: { ...type(12, c.textTertiary), flexShrink: 1 },
  art: { backgroundColor: c.muted, flex: 1, overflow: 'hidden' },
  sun: { backgroundColor: c.textPrimary, borderRadius: radius.full, height: '34%', left: '56%', position: 'absolute', top: '25%', width: '34%' },
  ripple: { backgroundColor: c.textPrimary, borderRadius: radius.xs, height: 3, position: 'absolute' },
  ring: { borderColor: c.textPrimary, borderRadius: radius.full, borderWidth: 6.5, position: 'absolute' },
  ringLast: { backgroundColor: c.textPrimary },
})
