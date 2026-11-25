import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import Svg, { Ellipse, Line, Rect } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { TextShell } from './type-writer'

const STEP_MS = 600
const STEP_GAP_MS = 120
const PAD = 6
const IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
const AnimatedLine = Animated.createAnimatedComponent(Line)
const AnimatedRect = Animated.createAnimatedComponent(Rect)
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse)

export type MarkKind = 'highlight' | 'underline' | 'circle' | 'box' | 'strike'
export type MarkerPart = string | { text: string; mark: MarkKind }

export type MarkerTextProps = {
  heading?: MarkerPart[]
  body?: MarkerPart[]
  styleKind?: 'soft' | 'original'
  /** A Replay button appears once the marks are drawn. */
  replay?: boolean
  /** Draws the Replay icon. */
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Mark({ text, mark, delay, still, textStyle }: { text: string; mark: MarkKind; delay: number; still: boolean; textStyle: StyleProp<TextStyle> }) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const [box, setBox] = useState({ width: 0, height: 0 })
  const drawn = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    if (!still) drawn.value = withDelay(delay, withTiming(1, { duration: STEP_MS, easing: mark === 'highlight' ? Easing.linear : IN_OUT }))
  }, [delay, still, mark, drawn])
  const w = box.width + PAD * 2
  const h = box.height + PAD
  const length = mark === 'box' ? 2 * (w + h) : mark === 'circle' ? Math.PI * (w + h) * 0.75 : w
  const dash = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }))
  const sweep = useAnimatedStyle(() => ({ transform: [{ scaleX: drawn.value }] }))
  const ink = { underline: colors.textSecondary, circle: colors.inverse, box: colors.success, strike: colors.danger, highlight: colors.ink10 }[mark]
  const line = { stroke: ink, strokeWidth: 1.5, strokeLinecap: 'round' as const, fill: 'none', strokeDasharray: [length, length], animatedProps: dash }
  return (
    <View onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      {mark === 'highlight' ? <Animated.View style={[styles.highlight, sweep]} /> : null}
      <Text style={textStyle}>{text}</Text>
      {mark !== 'highlight' && box.width > 0 ? (
        <View pointerEvents="none" style={styles.draw}>
          <Svg aria-hidden width={w} height={h}>
            {mark === 'underline' ? <AnimatedLine x1={0} y1={h - 3} x2={w} y2={h - 3} {...line} /> : null}
            {mark === 'strike' ? <AnimatedLine x1={0} y1={h / 2} x2={w} y2={h / 2} {...line} /> : null}
            {mark === 'box' ? <AnimatedRect x={2} y={2} width={w - 4} height={h - 4} {...line} /> : null}
            {mark === 'circle' ? <AnimatedEllipse cx={w / 2} cy={h / 2} rx={w / 2 - 2} ry={h / 2 - 2} {...line} /> : null}
          </Svg>
        </View>
      ) : null}
    </View>
  )
}

/** Marks drawn by hand over copy, one after another: highlight, underline, circle, box and strike. */
export function MarkerText({ heading = [], body = [], styleKind = 'soft', replay = true, renderIcon, animated = true, style }: MarkerTextProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [run, setRun] = useState(0)
  const [state, setState] = useState<'unmarked' | 'drawing' | 'marked'>('unmarked')
  const count = useMemo(() => [...heading, ...body].filter((part) => typeof part !== 'string').length, [heading, body])

  useEffect(() => {
    if (still) {
      setState('marked')
      return undefined
    }
    setState('drawing')
    const timer = setTimeout(() => setState('marked'), count * (STEP_MS + STEP_GAP_MS))
    return () => clearTimeout(timer)
  }, [run, count, still])

  let order = 0
  // Text cannot host drawn overlays, so copy wraps word by word in a row.
  const render = (parts: MarkerPart[], textStyle: StyleProp<TextStyle>): ReactNode => parts.map((part, i) => {
    if (typeof part === 'string') {
      return <Fragment key={i}>{part.split(/(?<=\s)/).map((word, j) => <Text key={j} style={textStyle}>{word}</Text>)}</Fragment>
    }
    const delay = order * (STEP_MS + STEP_GAP_MS)
    order += 1
    return <Mark key={`${run}-${i}`} text={part.text} mark={part.mark} delay={delay} still={still} textStyle={textStyle} />
  })

  const copy = (
    <View style={styles.copy}>
      {heading.length ? <View style={styles.wrap}>{render(heading, styles.heading)}</View> : null}
      {body.length ? <View style={styles.wrap}>{render(body, styles.body)}</View> : null}
      {replay && state === 'marked' && !still ? (
        <View style={styles.replay}>
          <Button variant="ghost" size="sm" animated={animated} {...(renderIcon ? { leadingIcon: renderIcon('rotate-ccw', 16) } : {})} onPress={() => setRun(run + 1)}>Replay</Button>
        </View>
      ) : null}
    </View>
  )
  if (styleKind === 'original') return <View style={style}>{copy}</View>
  return <TextShell name="Marker Text" state={state} {...(style ? { style } : {})}>{copy}</TextShell>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  copy: { gap: space[3] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  heading: { ...type(18, c.textPrimary, '600'), lineHeight: 24 },
  body: { ...type(14, c.textSecondary), lineHeight: 26 },
  highlight: { ...StyleSheet.absoluteFill, borderRadius: radius.xs, backgroundColor: c.ink10, transformOrigin: 'left' },
  draw: { position: 'absolute', top: -PAD / 2, left: -PAD },
  replay: { alignSelf: 'flex-start', marginLeft: -space[2] },
})
