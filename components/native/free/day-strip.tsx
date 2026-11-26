import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { press, radius, softElevation, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const DAY_MS = 86400000
const CAP = 56
const CAP_ON = 66
const CAP_HEIGHT = 80
const CAP_ON_HEIGHT = 108
const DISC = 44
const DISC_ON = 50
const GAP = space[1.5]
const TAP_SCALE = 0.96
const JUMP = { stiffness: 500, damping: 34, mass: 1 } as const
const PRESS = { ...press.spring, mass: 1 } as const

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export type DayStripProps = {
  /** The first day shown. */
  start: Date
  /** Days shown. Default 5. */
  days?: number
  value?: Date
  defaultValue?: Date
  onValueChange?: (value: Date) => void
  /** Days before this one sink onto the tray. */
  today?: Date
  locale?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const sameDay = (a: Date, b: Date | undefined): boolean => Boolean(b) && a.toDateString() === b?.toDateString()

function Capsule({ number, label, on, past, still, onPress }: { number: number; label: string; on: boolean; past: boolean; still: boolean; onPress: () => void }) {
  const styles = useThemed(createStyles)
  const grown = useSharedValue(on ? 1 : 0)
  const scale = useSharedValue(1)

  useEffect(() => {
    grown.value = still ? (on ? 1 : 0) : withSpring(on ? 1 : 0, JUMP)
  }, [on, still, grown])

  const capsule = useAnimatedStyle(() => ({
    height: CAP_HEIGHT + (CAP_ON_HEIGHT - CAP_HEIGHT) * grown.value,
    transform: [{ scale: scale.value }],
    width: CAP + (CAP_ON - CAP) * grown.value,
  }))
  const disc = useAnimatedStyle(() => {
    const size = DISC + (DISC_ON - DISC) * grown.value
    return { height: size, width: size }
  })

  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      aria-checked={on}
      style={[styles.capsule, past ? styles.capsulePast : styles.lifted, capsule]}
      onPress={onPress}
      onPressIn={() => { if (!still) scale.value = withSpring(TAP_SCALE, PRESS) }}
      onPressOut={() => { if (!still) scale.value = withSpring(1, PRESS) }}
    >
      <Animated.View style={[styles.disc, on && styles.discOn, disc]}>
        <Text style={[styles.number, past && styles.numberPast, on && styles.numberOn]}>{number}</Text>
      </Animated.View>
    </AnimatedPressable>
  )
}

/** Pick a day from a strip of soft capsules. The selected day grows and fills its disc with ink. */
export function DayStrip({ start, days = 5, value, defaultValue, onValueChange, today, locale = 'en-US', animated = true, style }: DayStripProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue ?? start)
  const current = value ?? held
  const list = useMemo(() => Array.from({ length: days }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)), [start, days])
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }), [locale])
  const full = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' }), [locale])
  const index = list.findIndex((day) => sameDay(day, current))
  const pointerX = useSharedValue(index * (CAP + GAP) + CAP_ON / 2 - space[1])
  const pointer = useAnimatedStyle(() => ({ transform: [{ translateX: pointerX.value }] }))

  useEffect(() => {
    const target = index * (CAP + GAP) + CAP_ON / 2 - space[1]
    pointerX.value = still ? target : withSpring(target, JUMP)
  }, [index, still, pointerX])

  function choose(day: Date): void {
    setHeld(day)
    onValueChange?.(day)
  }

  return (
    // Scrolls sideways when the days are wider than the screen, so no capsule is cut off.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={[styles.scroller, style]} contentContainerStyle={styles.strip} accessibilityLabel="Day" accessibilityRole="radiogroup">
      {index >= 0 ? (
        <Animated.View style={[styles.pointer, pointer]}>
          <Svg aria-hidden width={8} height={6}><Path d="M0 0h8L4 6Z" fill={colors.textPrimary} /></Svg>
        </Animated.View>
      ) : null}
      {list.map((day) => {
        const on = sameDay(day, current)
        const past = today ? day.getTime() < today.getTime() - DAY_MS / 2 : false
        return (
          <View key={day.toISOString()} style={styles.column}>
            <Text style={[styles.weekday, on && styles.weekdayOn]}>{weekday.format(day)}</Text>
            <Capsule number={day.getDate()} label={full.format(day)} on={on} past={past} still={still} onPress={() => choose(day)} />
          </View>
        )
      })}
    </ScrollView>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  scroller: { alignSelf: 'center', flexGrow: 0, maxWidth: '100%' },
  strip: { alignItems: 'flex-start', flexDirection: 'row', gap: GAP, paddingBottom: space[4], paddingHorizontal: space[1], paddingTop: space[3] },
  pointer: { height: 6, left: space[1], position: 'absolute', top: 0, width: 8 },
  column: { alignItems: 'center', gap: space[2], minWidth: 0 },
  weekday: type(12, c.textTertiary, '400', true),
  weekdayOn: { color: c.textPrimary, fontWeight: '600' },
  capsule: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'flex-start', paddingTop: space[2] },
  capsulePast: { backgroundColor: c.ink4, borderWidth: 0 },
  // The web soft elevation on today and future days; past days sit flat.
  lifted: { boxShadow: softElevation(c) },
  disc: { alignItems: 'center', borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center' },
  discOn: { backgroundColor: c.inverse, borderWidth: 0 },
  number: type(16, c.textPrimary, '500'),
  numberPast: { color: c.textTertiary },
  numberOn: { color: c.textInverse },
})
