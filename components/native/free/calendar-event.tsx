import { useEffect, useMemo } from 'react'
import { View, Text, Pressable, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
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
  const content = (
    <>
      <Animated.View style={[styles.tag, styles[`tag_${tone}`], pulse]} />
      <View style={styles.text}>
        <Text numberOfLines={dense ? 1 : 2} style={styles.title}>{title}</Text>
        {time ? <Text numberOfLines={1} style={styles.time}>{time}</Text> : null}
        {people ? <View accessible accessibilityRole="image" accessibilityLabel={`${people} people`} style={styles.people}>{Array.from({ length: Math.min(people, 3) }, (_, i) => <View key={i} style={styles.person} />)}</View> : null}
      </View>
    </>
  )
  const box = [styles.event, styles[`event_${tone}`], dense && styles.dense, state === 'selected' && styles[`selected_${tone}`], style]
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
  return useMemo(() => createStyles(colors), [colors])
}

const text = (size: number, lineHeight: number, weight: TextStyle['fontWeight'] = '400'): TextStyle => ({ fontFamily: font.sans, fontSize: size, lineHeight, fontWeight: weight, letterSpacing: font.tracking(size) })

const createStyles = (c: Colors) => StyleSheet.create({
  event: { flexDirection: 'row', gap: space[1.5], paddingVertical: space[1.5], paddingRight: space[2], paddingLeft: space[1.5], overflow: 'hidden', borderRadius: radius.lg },
  event_neutral: { backgroundColor: c.ink4 },
  event_accent: { backgroundColor: c.ink8 },
  event_success: { backgroundColor: c.ink5 },
  event_warning: { backgroundColor: c.ink10 },
  dense: { alignItems: 'center', paddingVertical: space[0.5] },
  selected_neutral: { borderWidth: 1.5, borderColor: c.textSecondary },
  selected_accent: { borderWidth: 1.5, borderColor: c.textPrimary },
  selected_success: { borderWidth: 1.5, borderColor: c.success },
  selected_warning: { borderWidth: 1.5, borderColor: c.textTertiary },
  tag: { width: 2, alignSelf: 'stretch', borderRadius: radius.xs },
  tag_neutral: { backgroundColor: c.textSecondary },
  tag_accent: { backgroundColor: c.textPrimary },
  tag_success: { backgroundColor: c.success },
  tag_warning: { backgroundColor: c.textTertiary },
  text: { flex: 1 },
  title: { ...text(12, 16, '500'), color: c.textPrimary },
  time: { ...text(11, 16), color: c.textSecondary },
  people: { flexDirection: 'row', gap: space[0.5], paddingTop: space[1] },
  person: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: c.textTertiary },
})
