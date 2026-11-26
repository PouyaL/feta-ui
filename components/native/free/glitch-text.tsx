import { useEffect, useMemo, useRef, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { font, space, useAppActive, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { TextShell } from './type-writer'

const BURST_MS = 420
const SLICE_A_MS = 140
const SLICE_B_MS = 180
const SHIFT = { normal: 3, strong: 5 } as const

export type GlitchTextProps = {
  text: string
  /** Soft puts it in the shell. Default `soft`. */
  styleKind?: 'soft' | 'original'
  /** `status` is a small label beside a value. A new value bursts once. */
  size?: 'display' | 'status'
  /** Mono label for `status`. */
  label?: string
  strength?: 'normal' | 'strong'
  /** Hold the burst, for specimens. */
  burst?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Slice({ text, textStyle, color, top, shift, duration, on }: { text: string; textStyle: StyleProp<TextStyle>; color: string; top: boolean; shift: number; duration: number; on: boolean }) {
  const styles = useThemed(makeStyles)
  const x = useSharedValue(0)
  const active = useAppActive()
  useEffect(() => {
    if (!on || !active) return undefined
    x.value = -1
    x.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, true)
    return () => cancelAnimation(x)
  }, [on, active, duration, x])
  const offset = useAnimatedStyle(() => ({ transform: [{ translateX: (x.value >= 0 ? 1 : -1) * shift * (top ? 1 : -1) }] }))
  const ink = useMemo(() => ({ color }), [color])
  if (!on) return null
  return (
    <Animated.View aria-hidden pointerEvents="none" style={[top ? styles.sliceTop : styles.sliceBottom, offset]}>
      <Text style={[textStyle, ink]}>{text}</Text>
    </Animated.View>
  )
}

/** Two coloured slices tear the word for a moment on press, or when the value changes. */
export function GlitchText({ text, styleKind = 'soft', size = 'display', label, strength = 'normal', burst, animated = true, style }: GlitchTextProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const last = useRef(text)
  useEffect(() => () => clearTimeout(timer.current), [])

  function fire(): void {
    if (still) return
    setOn(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOn(false), BURST_MS)
  }

  useEffect(() => {
    if (last.current === text) return
    last.current = text
    fire()
  })

  const bursting = !still && (burst ?? on)
  const textStyle = size === 'display' ? styles.display : styles.status
  const word = (
    <View style={styles.line}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {/* Tap to glitch is a flourish for the pointer, not a keyboard stop. The web reads the visible word (aria-label is not allowed on plain text there); iOS and Android read the label. */}
      <Pressable accessibilityRole="text" {...(Platform.OS === 'web' ? {} : { accessibilityLabel: text })} tabIndex={-1} disabled={still} {...(size === 'status' ? { accessibilityLiveRegion: 'polite' as const } : {})} onPress={fire}>
        <Text style={textStyle}>{text}</Text>
        <Slice text={text} textStyle={textStyle} color={colors.danger} top shift={SHIFT[strength]} duration={SLICE_A_MS} on={bursting} />
        <Slice text={text} textStyle={textStyle} color={colors.textTertiary} top={false} shift={SHIFT[strength]} duration={SLICE_B_MS} on={bursting} />
      </Pressable>
    </View>
  )
  if (styleKind === 'original') return <View style={style}>{word}</View>
  const state = bursting ? (size === 'status' ? 'status change' : strength === 'strong' ? 'burst strong' : 'burst') : size === 'status' ? 'status rest' : 'rest'
  return <TextShell name="Glitch Text" state={state} {...(style ? { style } : {})}>{word}</TextShell>
}

const DISPLAY_LINE = 40

const makeStyles = (c: Colors) => StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  display: { fontFamily: font.sans, fontSize: 32, lineHeight: DISPLAY_LINE, fontWeight: '600', letterSpacing: font.tracking(32), color: c.textPrimary },
  status: type(14, c.textPrimary, '500'),
  label: type(12, c.textTertiary, '400', true),
  sliceTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%', overflow: 'hidden' },
  sliceBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '42%', overflow: 'hidden', justifyContent: 'flex-end' },
})
