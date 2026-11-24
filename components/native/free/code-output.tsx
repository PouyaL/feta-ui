import { useEffect, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { ToneGlyph } from './badge'
import { type, useStill, useThemed } from './card'
import { Spinner } from './spinner'

const MARK_SPRING = { duration: 240, dampingRatio: 0.7 } as const
const LINE_MS = 200
const STREAM_MS = 40
const lineEnter = (index: number) => FadeInDown.duration(LINE_MS).delay(index * STREAM_MS).easing(Easing.bezierFn(0.23, 1, 0.32, 1)).withInitialValues({ transform: [{ translateY: 4 }] })

export type CodeOutputProps = {
  state: 'running' | 'done' | 'failed'
  command: string
  /** Live or final duration, like `2.1s`. */
  duration?: string
  /** Output so far, one string per line. */
  lines?: string[]
  /** Extra line in the danger colour, like `Exit code 1`. */
  footer?: ReactNode
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A command and its output. Lines stream in while it runs, then a mark settles. */
export function CodeOutput({ state, command, duration, lines = [], footer, animated = true, style }: CodeOutputProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const verb = state === 'running' ? 'Running' : state === 'done' ? 'Ran' : 'Failed to run'
  const scale = useSharedValue(1)
  useEffect(() => {
    if (state === 'running' || still) return
    scale.value = 0.6
    scale.value = withSpring(1, MARK_SPRING)
  }, [state, still, scale])
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <View style={[styles.tray, style]}>
      <View style={styles.header}>
        {state === 'running' ? <Spinner size={16} label={null} /> : (
          <Animated.View style={pop}><ToneGlyph tone={state === 'done' ? 'success' : 'danger'} size={16} color={state === 'done' ? colors.success : colors.danger} /></Animated.View>
        )}
        <Text style={styles.command} numberOfLines={1}>{verb} <Text style={styles.code}>{command}</Text></Text>
        {duration ? <Text style={styles.duration}>{duration}</Text> : null}
      </View>
      <View aria-busy={state === 'running'} accessibilityLiveRegion="polite" style={styles.card}>
        <Text style={styles.prompt}>$ {command}</Text>
        {lines.map((line, i) => <Animated.Text key={`${i}-${line}`} {...(still ? {} : { entering: lineEnter(i) })} style={styles.line}>{line}</Animated.Text>)}
        {state === 'running' && lines.length === 0 ? <Text style={styles.line}>…</Text> : null}
        {typeof footer === 'string' ? <Text style={styles.footer}>{footer}</Text> : footer}
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 36, paddingHorizontal: space[3] },
  command: { ...type(13, c.textSecondary), flex: 1, minWidth: 0 },
  code: type(12, c.textPrimary, '400', true),
  duration: type(12, c.textTertiary, '400', true),
  card: { gap: space[0.5], padding: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  prompt: type(12, c.textPrimary, '400', true),
  line: type(12, c.textSecondary, '400', true),
  footer: { ...type(12, c.danger, '400', true), marginTop: space[1] },
})
