import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { useFieldControl } from './field'

const WIDTH = 46
const HEIGHT = 28
const THUMB = 24
const INSET = 2
const STRETCH = 6
const HALO = 5
const FAST_MS = 150
const PRESS_MS = 100
// The web's --feta-motion-duration-thumb and --feta-motion-ease-thumb: the curve overshoots a touch, like a spring.
const THUMB_MS = 260
const THUMB_EASE = Easing.bezier(0.34, 1.4, 0.64, 1)
const SHAKE_LEG_MS = 80
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
// --feta-bg-danger-subtle (red 50 in Light, red 950 in Dark).
const DANGER_SUBTLE = { light: '#fef2f2', dark: '#450a0a' } as const

type TrackProps = { on: boolean; invalid: boolean; disabled: boolean; pressed: boolean; still: boolean }

/** The track alone, so a settings row can be the one target. */
function Track({ on, invalid, disabled, pressed, still }: TrackProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const travel = useSharedValue(on ? 1 : 0)
  const stretch = useSharedValue(0)
  const shade = useSharedValue(on ? 1 : 0)
  const x = useSharedValue(0)

  useEffect(() => {
    const target = on ? 1 : 0
    travel.value = still ? target : withTiming(target, { duration: THUMB_MS, easing: THUMB_EASE })
    shade.value = still ? target : withTiming(target, { duration: FAST_MS, easing: OUT })
  }, [on, still, travel, shade])

  useEffect(() => {
    const target = pressed && !still && !disabled ? 1 : 0
    stretch.value = still ? target : withTiming(target, { duration: PRESS_MS, easing: OUT })
  }, [pressed, disabled, still, stretch])

  useEffect(() => {
    if (!invalid || still) return
    const leg = { duration: SHAKE_LEG_MS, easing: OUT }
    x.value = withSequence(withTiming(-2, leg), withTiming(2, leg), withTiming(0, leg))
  }, [invalid, still, x])

  const { ink8, textPrimary, danger } = colors
  const dangerSubtle = isDark(colors) ? DANGER_SUBTLE.dark : DANGER_SUBTLE.light
  const room = WIDTH - INSET * 2 - THUMB
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(shade.value, [0, 1], invalid ? [dangerSubtle, danger] : [ink8, textPrimary]),
    transform: [{ translateX: x.value }],
  }))
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: travel.value * (room - STRETCH * stretch.value) }],
    width: THUMB + STRETCH * stretch.value,
  }))
  const haloStyle = useAnimatedStyle(() => ({ opacity: stretch.value, transform: [{ scale: 0.8 + stretch.value * 0.2 }] }))
  const glintStyle = useAnimatedStyle(() => ({ opacity: shade.value * 0.5 }))

  return (
    <Animated.View style={[styles.track, invalid && !on && styles.trackInvalid, disabled && styles.disabled, trackStyle]}>
      <Animated.View style={[styles.glint, glintStyle]} />
      {/* The halo is the thumb's sibling, drawn first, so it sits behind the thumb as the web's z-index -1 does. */}
      <Animated.View style={[styles.thumbSlot, thumbStyle]}>
        <Animated.View style={[styles.halo, on && styles.haloOn, haloStyle]} />
        <View style={styles.thumb} />
      </Animated.View>
    </Animated.View>
  )
}

function useToggle(checked: boolean | undefined, defaultChecked: boolean, onCheckedChange: ((next: boolean) => void) | undefined) {
  const [held, setHeld] = useState(defaultChecked)
  const [pressed, setPressed] = useState(false)
  const on = checked ?? held
  return {
    on,
    pressed,
    handlers: {
      onPress: (): void => { setHeld(!on); onCheckedChange?.(!on) },
      onPressIn: (): void => setPressed(true),
      onPressOut: (): void => setPressed(false),
    },
  }
}

export type SwitchProps = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  invalid?: boolean
  disabled?: boolean
  accessibilityLabel?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A toggle for a setting that applies at once. The thumb stretches under the finger and springs across. */
export function Switch({ checked, defaultChecked = false, onCheckedChange, invalid, disabled, accessibilityLabel, animated = true, style }: SwitchProps) {
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled })
  const { on, pressed, handlers } = useToggle(checked, defaultChecked, onCheckedChange)
  return (
    <Pressable {...handlers} accessibilityHint={field.hint} accessibilityLabel={accessibilityLabel} accessibilityRole="switch" aria-checked={on} aria-disabled={field.disabled} disabled={field.disabled} hitSlop={8} style={style}>
      <Track on={on} invalid={field.invalid} disabled={field.disabled} pressed={pressed} still={still} />
    </Pressable>
  )
}

export type SwitchFieldProps = SwitchProps & { label: ReactNode; description?: ReactNode }

/** A settings row. A press anywhere on the row toggles it. */
export function SwitchField({ label, description, checked, defaultChecked = false, onCheckedChange, invalid, disabled, accessibilityLabel, animated = true, style }: SwitchFieldProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled })
  const { on, pressed, handlers } = useToggle(checked, defaultChecked, onCheckedChange)
  return (
    <Pressable
      {...handlers}
      accessibilityHint={typeof description === 'string' ? description : field.hint}
      accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
      accessibilityRole="switch"
      aria-checked={on} aria-disabled={field.disabled}
      disabled={field.disabled}
      style={[styles.row, field.disabled && styles.dimmed, style]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Track on={on} invalid={field.invalid} disabled={field.disabled} pressed={pressed} still={still} />
    </Pressable>
  )
}

const isDark = (c: Colors): boolean => c.surface !== '#ffffff'

const createStyles = (c: Colors) => StyleSheet.create({
  track: { borderRadius: radius.full, height: HEIGHT, justifyContent: 'center', padding: space[0.5], width: WIDTH },
  // An inset ring, as the web's box-shadow, so the 1 px line does not push the thumb in.
  trackInvalid: { boxShadow: `inset 0px 0px 0px 1px ${c.danger}` },
  disabled: { opacity: 0.4 },
  dimmed: { opacity: 0.5 },
  thumbSlot: { height: THUMB },
  // --feta-elevation-soft.
  thumb: {
    backgroundColor: c.surface, borderRadius: radius.full, flex: 1,
    boxShadow: isDark(c) ? '0px 1px 2px 0px #00000080, 0px 6px 20px -10px #00000099' : '0px 1px 2px 0px #0000000a, 0px 6px 20px -10px #0000001f',
  },
  halo: { backgroundColor: c.ink5, borderRadius: radius.full, bottom: -HALO, left: -HALO, position: 'absolute', right: -HALO, top: -HALO },
  haloOn: { backgroundColor: c.ink10 },
  glint: { backgroundColor: c.textInverse, borderRadius: radius.full, height: 4, left: space[2], position: 'absolute', width: 4 },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[3], justifyContent: 'space-between', minHeight: 44, width: '100%' },
  text: { flex: 1, minWidth: 0 },
  title: type(15, c.textPrimary, '500'),
  description: { ...type(14, c.textSecondary), lineHeight: 20 },
})
