import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { accent, radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { TextShell } from './type-writer'

const STEP_MS = 600
const STEP_GAP_MS = 120
const PAD = 6
const IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
const AnimatedPath = Animated.createAnimatedComponent(Path)

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

/** The web's hand drawn strokes, drawn on a 0 to 100 box stretched over the words. */
function strokePath(mark: Exclude<MarkKind, 'highlight'>, w: number, h: number): string {
  const x = (n: number): string => ((n / 100) * w).toFixed(1)
  const y = (n: number): string => ((n / 100) * h).toFixed(1)
  if (mark === 'circle') return `M${x(50)} ${y(4)}C${x(22)} ${y(2)} ${x(2)} ${y(22)} ${x(4)} ${y(50)}S${x(34)} ${y(96)} ${x(62)} ${y(94)}S${x(100)} ${y(68)} ${x(96)} ${y(44)}S${x(70)} ${y(2)} ${x(44)} ${y(6)}`
  if (mark === 'box') return `M${x(3)} ${y(4)}H${x(97)}V${y(96)}H${x(3)}Z`
  if (mark === 'strike') return `M0 ${y(54)}C${x(30)} ${y(48)} ${x(66)} ${y(58)} ${w} ${y(50)}`
  // Just under the glyphs: the copy's 26 pt line leaves room below the baseline, so 92% sat near the next line.
  return `M0 ${y(80)}C${x(30)} ${y(74)} ${x(66)} ${y(86)} ${w} ${y(78)}`
}

/** A little over each stroke's length, so the dash never leaves a gap at the end. */
function strokeLength(mark: Exclude<MarkKind, 'highlight'>, w: number, h: number): number {
  if (mark === 'circle') return Math.PI * (w + h) * 0.62
  if (mark === 'box') return 2 * (w + h)
  return w * 1.1
}

/** One word of a highlight: the amber marker sweeps across it in its share of the step. */
function HighlightWord({ word, delay, duration, still, textStyle }: { word: string; delay: number; duration: number; still: boolean; textStyle: StyleProp<TextStyle> }) {
  const styles = useThemed(makeStyles)
  const drawn = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    if (!still) drawn.value = withDelay(delay, withTiming(1, { duration, easing: Easing.linear }))
  }, [delay, duration, still, drawn])
  const sweep = useAnimatedStyle(() => ({ transform: [{ scaleX: drawn.value }] }))
  return (
    <View style={styles.highlightWord}>
      <Animated.View style={[styles.highlight, sweep]} />
      <Text style={textStyle}>{word}</Text>
    </View>
  )
}

function Mark({ text, mark, delay, still, textStyle }: { text: string; mark: Exclude<MarkKind, 'highlight'>; delay: number; still: boolean; textStyle: StyleProp<TextStyle> }) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const [box, setBox] = useState({ width: 0, height: 0 })
  const drawn = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    if (!still) drawn.value = withDelay(delay, withTiming(1, { duration: STEP_MS, easing: IN_OUT }))
  }, [delay, still, drawn])
  const w = box.width + PAD * 2
  const h = box.height + PAD
  const length = strokeLength(mark, w, h)
  const dash = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }))
  // The web's status inks: warning orange, accent blue, the strong success green and danger red.
  const ink = { underline: colors.warning, circle: colors.accent, box: colors.success, strike: colors.danger }[mark]
  return (
    <View onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <Text style={textStyle}>{text}</Text>
      {box.width > 0 ? (
        <View pointerEvents="none" style={styles.draw}>
          <Svg aria-hidden width={w} height={h}>
            <AnimatedPath d={strokePath(mark, w, h)} stroke={ink} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" fill="none" strokeDasharray={[length, length]} animatedProps={dash} />
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
    if (part.mark === 'highlight') {
      // Word by word, so a highlight wraps across lines like the web's cloned box decoration.
      const words = part.text.split(/(?<=\s)/)
      const share = STEP_MS / words.length
      return <Fragment key={`${run}-${i}`}>{words.map((word, j) => <HighlightWord key={j} word={word} delay={delay + j * share} duration={share} still={still} textStyle={textStyle} />)}</Fragment>
    }
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
  heading: { ...type(24, c.textPrimary, '600'), lineHeight: 32 },
  body: { ...type(14, c.textSecondary), lineHeight: 26 },
  highlightWord: { paddingHorizontal: space[0.5], marginHorizontal: -space[0.5] },
  // The web's amber marker, the same in Light and Dark.
  highlight: { ...StyleSheet.absoluteFill, borderRadius: radius.xs, backgroundColor: accent.amber.from, transformOrigin: 'left' },
  draw: { position: 'absolute', top: -PAD / 2, left: -PAD },
  replay: { alignSelf: 'flex-start', marginLeft: -space[2] },
})
