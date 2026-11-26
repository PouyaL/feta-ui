import { useEffect, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, useColorScheme, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, withSequence, withSpring, cancelAnimation, Easing } from 'react-native-reanimated'
import { font, press, pressedState, radius, space, useColors, useReduceMotion, type Colors } from '../kit'

export type CalendarEventTone = 'neutral' | 'accent' | 'success' | 'warning'

export type CalendarEventProps = {
  title: string
  time?: string | undefined
  /** Default `neutral`. */
  tone?: CalendarEventTone
  /** `selected` rings the block, `now` pulses its tag. Default `default`. */
  state?: 'default' | 'selected' | 'now'
  /** One line for a block under 30 px tall. */
  dense?: boolean
  /** Attendee dots, up to three. */
  people?: number
  /** Makes the block a button. */
  onSelect?: () => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const BREATH_MS = 2000

/** An event block for week views: colour tag, title, time and attendees. */
export function CalendarEvent({ title, time, tone = 'neutral', state = 'default', dense = false, people = 0, onSelect, animated = true, style }: CalendarEventProps) {
  const styles = useStyles()
  const reduce = useReduceMotion()
  const breath = useSharedValue(1)
  const scale = useSharedValue(1)
  useEffect(() => {
    if (state === 'selected' && animated && !reduce) scale.value = withSequence(withTiming(0.95, { duration: 0 }), withSpring(1, { stiffness: 420, damping: 18 }))
  }, [state, animated, reduce, scale])
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  useEffect(() => {
    if (state !== 'now' || !animated || reduce) {
      cancelAnimation(breath)
      breath.value = 1
      return
    }
    breath.value = withRepeat(withTiming(0.4, { duration: BREATH_MS / 2, easing: Easing.inOut(Easing.ease) }), -1, true)
    return () => cancelAnimation(breath)
  }, [state, animated, reduce, breath])
  const pulse = useAnimatedStyle(() => ({ opacity: breath.value }))
  const selected = state === 'selected'
  const content = (
    <>
      <Animated.View style={[styles.tag, selected ? styles.tagSelected : styles[`tag_${tone}`], pulse]} />
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, selected && styles.inverse]}>{title}</Text>
        {time ? <Text numberOfLines={1} style={[styles.time, selected && styles.inverse]}>{time}</Text> : null}
        {people ? <View accessible accessibilityRole="image" accessibilityLabel={`${people} people`} style={styles.people}>{Array.from({ length: Math.min(people, 3) }, (_, i) => <View key={i} style={[styles.person, styles[`person_${i}` as 'person_0'], i > 0 && styles.personNext, selected && styles.personSelected]} />)}</View> : null}
      </View>
      {/* Now: a 2 point danger ring inside the block, as the web's -2 px outline. */}
      {state === 'now' ? <View pointerEvents="none" style={styles.nowRing} /> : null}
    </>
  )
  const box = [styles.event, selected ? styles.eventSelected : styles[`event_${tone}`], dense && styles.dense, style]
  if (!onSelect) return <View style={box}>{content}</View>
  // A button presses in to 0.97 and pops when it becomes selected.
  return (
    <Animated.View style={pop}>
      <Pressable accessibilityRole="button" accessibilityLabel={time ? `${title}, ${time}` : title} {...pressedState(state === 'selected')} hitSlop={space[1]} onPressIn={() => { if (animated && !reduce) scale.value = withSpring(0.97, press.spring) }} onPressOut={() => { if (animated && !reduce) scale.value = withSpring(1, press.spring) }} onPress={onSelect} style={box}>{content}</Pressable>
    </Animated.View>
  )
}

const useStyles = () => {
  const colors = useColors()
  const dark = useColorScheme() === 'dark'
  return useMemo(() => createStyles(colors, dark), [colors, dark])
}

/** The web's --feta-bg-*-subtle fills (blue, emerald and orange 50, or 950 in Dark), which kit.ts does not carry. */
const SUBTLE = {
  light: { accent: '#eff6ff', success: '#ecfdf5', warning: '#fff7ed' },
  dark: { accent: '#172554', success: '#022c22', warning: '#431407' },
} as const

const text = (size: number, lineHeight: number, weight: TextStyle['fontWeight'] = '400'): TextStyle => ({ fontFamily: font.sans, fontSize: size, lineHeight, fontWeight: weight, letterSpacing: font.tracking(size) })

// FetaUI 157 Handoff: 140 wide, p6 8 6 6, r8, the tone's subtle fill and a 2 px tag in its ink. Selected inverts.
const createStyles = (c: Colors, dark: boolean) => {
  const subtle = dark ? SUBTLE.dark : SUBTLE.light
  return StyleSheet.create({
    event: { flexDirection: 'row', gap: space[1.5], width: 140, maxWidth: '100%', paddingVertical: space[1.5], paddingRight: space[2], paddingLeft: space[1.5], overflow: 'hidden', borderRadius: radius.lg },
    event_neutral: { backgroundColor: c.ink4 },
    event_accent: { backgroundColor: subtle.accent },
    event_success: { backgroundColor: subtle.success },
    event_warning: { backgroundColor: subtle.warning },
    eventSelected: { backgroundColor: c.inverse },
    dense: { alignItems: 'center', paddingVertical: space[0.5] },
    nowRing: { ...StyleSheet.absoluteFill, borderWidth: 2, borderColor: c.danger, borderRadius: radius.lg },
    tag: { width: 2, alignSelf: 'stretch', borderRadius: radius.xs },
    tag_neutral: { backgroundColor: c.textSecondary },
    tag_accent: { backgroundColor: c.accent },
    tag_success: { backgroundColor: c.success },
    tag_warning: { backgroundColor: c.warning },
    tagSelected: { backgroundColor: c.textInverse },
    text: { flex: 1, gap: space[0.5], minWidth: 0 },
    title: { ...text(12, 16, '500'), color: c.textPrimary },
    time: { fontFamily: font.mono, fontSize: 10, lineHeight: 12, color: c.textSecondary },
    inverse: { color: c.textInverse },
    people: { flexDirection: 'row', paddingTop: space[0.5] },
    person: { width: 12, height: 12, borderRadius: radius.full, borderWidth: 2, borderColor: c.surface },
    personNext: { marginLeft: -space[1] },
    personSelected: { borderColor: c.inverse },
    person_0: { backgroundColor: c.accent },
    person_1: { backgroundColor: c.success },
    person_2: { backgroundColor: c.warning },
  })
}
