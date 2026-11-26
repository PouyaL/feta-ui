import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { font, press, radius, space, type Colors } from '../kit'
import { Button, SELF } from './button'
import { EASE_STANDARD, panelEnter, type, useStill, useThemed } from './card'

const SCORES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const
const UPDATE_MS = 240
const reveal = FadeInDown.duration(UPDATE_MS).easing(EASE_STANDARD).withInitialValues({ opacity: 0, transform: [{ translateY: -4 }] })
const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

function Box({ score, on, label, still, onPick }: { score: number; on: boolean; label: string; still: boolean; onPick: (score: number) => void }) {
  const styles = useThemed(makeStyles)
  const scale = useSharedValue(1)
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <AnimatedPressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      aria-checked={on}
      hitSlop={{ top: 4, bottom: 4 }}
      onPress={() => onPick(score)}
      onPressIn={() => { if (!still) scale.value = withSpring(press.scale, press.spring) }}
      onPressOut={() => { if (!still) scale.value = withSpring(1, press.spring) }}
      style={[styles.box, on ? styles.boxOn : null, motion]}
    >
      <Text style={[styles.boxText, on ? styles.boxTextOn : null]}>{score}</Text>
    </AnimatedPressable>
  )
}

export type NpsScaleProps = {
  question: string
  /** Default `Not likely`. */
  low?: string
  /** Default `Very likely`. */
  high?: string
  defaultValue?: number
  onSubmit?: (score: number) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Eleven equal boxes. Choosing one inverts it and reveals Submit. */
export function NpsScale({ question, low = 'Not likely', high = 'Very likely', defaultValue, onSubmit, animated = true, style }: NpsScaleProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [score, setScore] = useState(defaultValue)
  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} style={[styles.ring, style]}>
      <View style={styles.nps}>
        <Text accessibilityRole="header" style={styles.question}>{question}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={question} style={styles.scale}>
          {SCORES.map((n) => <Box key={n} score={n} on={score === n} still={still} label={n === 0 ? `0, ${low}` : n === 10 ? `10, ${high}` : String(n)} onPick={setScore} />)}
        </View>
        <View style={styles.ends} aria-hidden>
          <Text style={styles.end}>{low}</Text>
          <Text style={styles.end}>{high}</Text>
        </View>
        {score === undefined ? null : (
          <Animated.View {...(still ? {} : { entering: reveal })} style={styles.result}>
            <Text accessibilityLiveRegion="polite" style={styles.picked}>You picked {score}</Text>
            <Button style={SELF.center} size="sm" animated={animated} onPress={() => onSubmit?.(score)}>Submit</Button>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  ring: { width: '100%', maxWidth: 358, padding: space[1], borderRadius: radius.frame, backgroundColor: c.ink4 },
  nps: { gap: space[3], padding: space[4], borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  question: type(14, c.textPrimary, '500'),
  scale: { flexDirection: 'row', gap: space[0.5] },
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: radius.lg, borderWidth: 1, borderColor: c.ink10, backgroundColor: c.surface },
  boxOn: { borderColor: 'transparent', backgroundColor: c.inverse },
  boxText: { fontFamily: font.sans, fontSize: 13, fontWeight: '500', fontVariant: ['tabular-nums'], color: c.textPrimary },
  boxTextOn: { color: c.textInverse },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: type(12, c.textTertiary),
  result: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  picked: { ...type(13, c.textSecondary), lineHeight: 20 },
})
