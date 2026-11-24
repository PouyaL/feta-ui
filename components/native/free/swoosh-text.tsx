import { useMemo, useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated'
import { font, useColors, type Colors } from '../kit'
import { useStill, useThemed } from './card'
import { TextShell } from './type-writer'

const DEPTH = 8
const SINK_RADIUS = 90
const SINK_MAX_DEG = 8
const SINK_DROP = 4
const LAYERS = [0.5, 0.25] as const
const REST_SPRING = { stiffness: 320, damping: 30 } as const

export type SwooshTextProps = {
  text: string
  styleKind?: 'soft' | 'original'
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type LetterProps = { char: string; light: SharedValue<number>; pointer: SharedValue<number>; pressing: SharedValue<number>; still: boolean }

function Letter({ char, light, pointer, pressing, still }: LetterProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const center = useSharedValue(0)
  const measure = (e: LayoutChangeEvent): void => { center.value = e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2 }
  const sink = useAnimatedStyle(() => {
    const near = pressing.value * Math.max(0, 1 - Math.abs(center.value - pointer.value) / SINK_RADIUS)
    const lean = pointer.value > center.value ? -1 : 1
    return { transform: [{ translateY: near * SINK_DROP }, { rotate: `${lean * near * SINK_MAX_DEG}deg` }] }
  })
  const back = useAnimatedStyle(() => ({ transform: [{ translateX: light.value * DEPTH * LAYERS[0] }, { translateY: 4 }] }))
  const mid = useAnimatedStyle(() => ({ transform: [{ translateX: light.value * DEPTH * LAYERS[1] }, { translateY: 2 }] }))
  const ink = useMemo(() => ({ color: colors.textTertiary }), [colors.textTertiary])
  const shown = char === ' ' ? ' ' : char
  return (
    <Animated.View onLayout={measure} style={sink}>
      {still ? null : <Animated.Text style={[styles.letter, styles.layer, ink, back]}>{shown}</Animated.Text>}
      {still ? null : <Animated.Text style={[styles.letter, styles.layer, ink, mid]}>{shown}</Animated.Text>}
      <Animated.Text style={styles.letter}>{shown}</Animated.Text>
    </Animated.View>
  )
}

/** Extruded letters lit by the finger. Dragging swings the depth, a touch sinks the letters nearby. */
export function SwooshText({ text, styleKind = 'soft', animated = true, style }: SwooshTextProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const light = useSharedValue(1)
  const pointer = useSharedValue(0)
  const pressing = useSharedValue(0)
  const wide = useSharedValue(1)
  const [state, setState] = useState<'rest' | 'light swung' | 'pressed'>('rest')

  const pan = Gesture.Pan()
    .enabled(!still)
    .minDistance(0)
    .onBegin((e) => {
      pointer.value = e.x
      pressing.value = withSpring(1, REST_SPRING)
      runOnJS(setState)('pressed')
    })
    .onUpdate((e) => {
      pointer.value = e.x
      light.value = -((e.x / wide.value) * 2 - 1)
    })
    .onFinalize(() => {
      pressing.value = withSpring(0, REST_SPRING)
      light.value = withSpring(1, REST_SPRING)
      runOnJS(setState)('rest')
    })

  const word = (
    <GestureDetector gesture={pan}>
      <View accessible accessibilityRole="image" accessibilityLabel={text} onLayout={(e) => { wide.value = e.nativeEvent.layout.width }} style={styles.word}>
        {Array.from(text).map((char, i) => <Letter key={i} char={char} light={light} pointer={pointer} pressing={pressing} still={still} />)}
      </View>
    </GestureDetector>
  )
  if (styleKind === 'original') return <View style={style}>{word}</View>
  return <TextShell name="Swoosh Text" state={state} {...(style ? { style } : {})}>{word}</TextShell>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  word: { flexDirection: 'row', flexWrap: 'wrap' },
  letter: { fontFamily: font.sans, fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: font.tracking(32), color: c.textPrimary },
  layer: { position: 'absolute', top: 0, left: 0 },
})
