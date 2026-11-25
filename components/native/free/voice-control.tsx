import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { radius, space, toggleState, useColors, useReduceMotion, type Colors } from '../kit'
import { PressScale, useLoop, withInk, type PressScaleProps } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

export type VoiceControlKind = 'mic' | 'listening' | 'muted' | 'captions' | 'captions-on' | 'stop' | 'end' | 'more'

const LABEL: Record<VoiceControlKind, string> = {
  mic: 'Start talking', listening: 'Stop listening', muted: 'Unmute', captions: 'Turn captions on', 'captions-on': 'Turn captions off', stop: 'Stop', end: 'End call', more: 'More',
}

const ICON: Record<Exclude<VoiceControlKind, 'listening'>, string> = {
  mic: 'mic', muted: 'mic-off', captions: 'captions', 'captions-on': 'captions', stop: 'stop', end: 'call-end', more: 'more-horizontal',
}

const ICON_SIZE = 20
const LEVELS = [8, 14, 10, 16, 8]
/** Where each bar starts in the 1800 ms there and back. */
const PHASES = [0, 1 / 6, 1 / 3, 1 / 12, 1 / 4]
const LEVEL_LOOP_MS = 1800
const LEVEL_MS = 100
const HALO_MS = 2400

export type VoiceControlProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  control?: VoiceControlKind
  /** Defaults to a label for the control. */
  label?: string
  /** Bar heights in points for a real level meter. Leave it out for the idle loop. */
  levels?: number[]
  /** Draws the control's icon by name: `mic`, `mic-off`, `captions`, `stop`, `call-end`, `more-horizontal`. */
  renderIcon: RenderIcon
  /** `false` turns off the press scale and the halo. Bars still move: they carry information. */
  animated?: boolean
}

function Bar({ height, phase, clock, live }: { height: number; phase: number; clock: SharedValue<number>; live: boolean }) {
  const styles = useThemed(createStyles)
  const level = useSharedValue(height)

  useEffect(() => {
    level.value = withTiming(height, { duration: LEVEL_MS, easing: Easing.linear })
  }, [height, level])

  const barStyle = useAnimatedStyle(() => {
    const wave = (1 - Math.cos(((clock.value + phase) % 1) * Math.PI * 2)) / 2
    return { height: level.value, transform: [{ scaleY: live ? 1 - wave * 0.55 : 1 }] }
  })
  return <Animated.View style={[styles.bar, barStyle]} />
}

function Level({ levels, disabled }: { levels: number[] | undefined; disabled: boolean }) {
  const styles = useThemed(createStyles)
  const reduce = useReduceMotion()
  const live = !levels && !disabled && !reduce
  const clock = useLoop(live, LEVEL_LOOP_MS)
  return (
    <View style={styles.level}>
      {LEVELS.map((height, index) => <Bar key={index} height={levels?.[index] ?? height} phase={PHASES[index] ?? 0} clock={clock} live={live} />)}
    </View>
  )
}

function Halo() {
  const styles = useThemed(createStyles)
  const clock = useLoop(true, HALO_MS)
  const haloStyle = useAnimatedStyle(() => {
    const swell = (1 - Math.cos(clock.value * Math.PI * 2)) / 2
    return { opacity: interpolate(swell, [0, 1], [0.15, 0.09]), transform: [{ scale: interpolate(swell, [0, 1], [1, 1.14]) }] }
  })
  return <Animated.View pointerEvents="none" style={[styles.halo, haloStyle]} />
}

/** Round controls for voice and call surfaces. */
export function VoiceControl({ control = 'mic', label, levels, renderIcon, animated = true, disabled, style, accessibilityState, ...rest }: VoiceControlProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const off = Boolean(disabled)
  const toggle = control === 'captions' || control === 'captions-on' || control === 'muted'
  const box = off ? 'offBox' : BOX[control]
  const ink = off ? 'textQuaternary' : INK[control]
  const pressedKey = PRESSED[control]

  return (
    <PressScale
      {...(toggle ? toggleState(control !== 'captions') : { accessibilityRole: 'button' as const })}
      accessibilityLabel={label ?? LABEL[control]}
      aria-disabled={off}
      {...(accessibilityState ? { accessibilityState } : {})}
      still={still}
      disabled={disabled}
      contentStyle={[styles.control, control === 'end' && styles.wide, styles[box]]}
      pressedStyle={off || !pressedKey ? undefined : styles[pressedKey]}
      style={style}
      {...rest}
    >
      {control === 'listening' ? (
        <>
          {still || off ? null : <Halo />}
          <Level levels={levels} disabled={off} />
        </>
      ) : withInk(renderIcon(ICON[control], ICON_SIZE), colors[ink])}
    </PressScale>
  )
}

const BOX = { mic: 'softBox', listening: 'dangerBox', muted: 'mutedBox', captions: 'softBox', 'captions-on': 'inverseBox', stop: 'inverseBox', end: 'dangerBox', more: 'clearBox' } as const
const INK = { mic: 'textPrimary', listening: 'textInverse', muted: 'danger', captions: 'textPrimary', 'captions-on': 'textInverse', stop: 'textInverse', end: 'textInverse', more: 'textPrimary' } as const
const PRESSED = { mic: 'softPressed', listening: null, muted: null, captions: 'softPressed', 'captions-on': null, stop: null, end: null, more: 'clearPressed' } as const

export type VoiceBarProps = {
  state?: 'idle' | 'listening' | 'muted'
  defaultState?: 'idle' | 'listening' | 'muted'
  onStateChange?: (state: 'idle' | 'listening' | 'muted') => void
  /** Second line. Defaults to the role while idle, then the elapsed time. */
  meta?: string
  onEnd?: () => void
  onMore?: () => void
  /** Passed to every control. */
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** The composed voice bar: status, timer and call controls. */
export function VoiceBar({ state, defaultState = 'idle', onStateChange, meta, onEnd, onMore, renderIcon, animated = true, style }: VoiceBarProps) {
  const styles = useThemed(createStyles)
  const [held, setHeld] = useState(defaultState)
  const [captions, setCaptions] = useState(false)
  const current = state ?? held

  function step(_: GestureResponderEvent): void {
    const next = current === 'idle' ? 'listening' : current === 'listening' ? 'muted' : 'listening'
    setHeld(next)
    onStateChange?.(next)
  }

  const status = current === 'idle' ? 'Tap to talk' : current === 'listening' ? 'Listening' : 'Muted'
  const second = meta ?? (current === 'idle' ? 'Assistant' : '02:14')

  return (
    <View role="group" accessibilityLabel="Voice" style={[styles.tray, style]}>
      <View style={styles.card}>
        <VoiceControl control={current === 'idle' ? 'mic' : current} renderIcon={renderIcon} animated={animated} onPress={step} />
        <View style={styles.meta}>
          <Text numberOfLines={1} accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>
          <Text numberOfLines={1} style={styles.second}>{second}</Text>
        </View>
        <View style={styles.controls}>
          <VoiceControl control={captions ? 'captions-on' : 'captions'} renderIcon={renderIcon} animated={animated} onPress={() => setCaptions(!captions)} />
          <VoiceControl control="more" renderIcon={renderIcon} animated={animated} onPress={onMore} />
          <VoiceControl control="end" renderIcon={renderIcon} animated={animated} onPress={onEnd} />
        </View>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  control: { alignItems: 'center', borderRadius: radius.full, height: 52, justifyContent: 'center', overflow: 'visible', width: 52 },
  wide: { width: 72 },
  softBox: { backgroundColor: c.ink5 },
  softPressed: { backgroundColor: c.ink10 },
  clearBox: { backgroundColor: 'transparent' },
  clearPressed: { backgroundColor: c.ink8 },
  mutedBox: { backgroundColor: c.ink5 },
  inverseBox: { backgroundColor: c.inverse },
  dangerBox: { backgroundColor: c.danger },
  offBox: { backgroundColor: c.ink5 },
  halo: { backgroundColor: c.danger, borderRadius: radius.full, bottom: -space[1], left: -space[1], position: 'absolute', right: -space[1], top: -space[1] },
  level: { alignItems: 'center', flexDirection: 'row', gap: space[0.5] },
  bar: { backgroundColor: c.textInverse, borderRadius: radius.xs, width: 3 },
  tray: { alignSelf: 'flex-start', backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: '100%', padding: space[1] },
  card: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space[3], padding: space[2] },
  meta: { minWidth: 58 },
  status: type(16, c.textPrimary, '500'),
  second: type(12, c.textSecondary),
  controls: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
})
