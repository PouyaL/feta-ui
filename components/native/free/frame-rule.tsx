import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { useStill, useThemed } from './card'

const DRAW_MS = 600
const DOT_DELAY_MS = 480
const DOT_MS = 160
const INSET = 20
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const CORNERS = ['tl', 'tr', 'bl', 'br'] as const

export type FrameRuleProps = {
  children: ReactNode
  /** Band at 4% and rules inked inside the column. */
  selected?: boolean
  /** `false` keeps the rules drawn from the start. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** The hairlines of a framed section: sides, rules past the edges, a dot at each crossing. Never for forms. */
export function FrameRule({ children, selected = false, animated = true, style }: FrameRuleProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const drawn = useSharedValue(still ? 1 : 0)
  const dots = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    if (still) return
    drawn.value = withTiming(1, { duration: DRAW_MS, easing: OUT })
    dots.value = withDelay(DOT_DELAY_MS, withTiming(1, { duration: DOT_MS, easing: OUT }))
  }, [still, drawn, dots])
  const rule = useAnimatedStyle(() => ({ transform: [{ scaleX: drawn.value }] }))
  const dot = useAnimatedStyle(() => ({ transform: [{ scale: dots.value }] }))
  const line = selected ? styles.ruleSelected : null
  return (
    <View style={[styles.frame, style]}>
      <Animated.View style={[styles.rule, styles.ruleTop, line, rule]} />
      <Animated.View style={[styles.rule, styles.ruleBottom, line, rule]} />
      <View style={[styles.side, styles.sideLeft]} />
      <View style={[styles.side, styles.sideRight]} />
      {CORNERS.map((corner) => <Animated.View key={corner} style={[styles.dot, styles[corner], dot]} />)}
      <View style={[styles.column, selected ? styles.columnSelected : null]}>{children}</View>
    </View>
  )
}

const DOT = 10
const DOT_OFFSET = space[4] - DOT / 2

const makeStyles = (c: Colors) => StyleSheet.create({
  frame: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingVertical: space[6], paddingHorizontal: INSET, overflow: 'hidden', borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8 },
  rule: { position: 'absolute', right: 0, left: 0, height: 1, backgroundColor: c.ink8 },
  ruleTop: { top: space[4] },
  ruleBottom: { bottom: space[4] },
  ruleSelected: { backgroundColor: c.textSecondary },
  side: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: c.ink8 },
  sideLeft: { left: INSET },
  sideRight: { right: INSET },
  dot: { position: 'absolute', zIndex: 1, width: DOT, height: DOT, borderWidth: 3, borderColor: c.surface, borderRadius: radius.full, backgroundColor: c.textSecondary },
  tl: { top: DOT_OFFSET, left: INSET - DOT / 2 },
  tr: { top: DOT_OFFSET, right: INSET - DOT / 2 },
  bl: { bottom: DOT_OFFSET, left: INSET - DOT / 2 },
  br: { bottom: DOT_OFFSET, right: INSET - DOT / 2 },
  column: { padding: space[4] },
  columnSelected: { backgroundColor: c.ink4 },
})
