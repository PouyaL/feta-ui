import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Line, Path, Rect } from 'react-native-svg'
import { accent, radius, softElevation, space, type Colors } from '../kit'
import { Button, SELF } from './button'
import { type, useStill, useThemed } from './card'

/** Print: 40 ms per line of paper. */
const LINE_MS = 40
/** Lines the header, rules, totals, barcode and footer take, on top of the items. */
const BASE_LINES = 16
/** The Torn frame: the paper lands 118 down and 21 left, tilted 8 degrees. */
const TORN = { x: -21, y: 118, rotate: -8 }
/** A pull past this tears the paper. */
const PULL = 40
const PULL_LIMIT = 64
const PULL_ELASTIC = 0.1
const SETTLE = { stiffness: 420, damping: 42 } as const
/** How much paper shows at `frozen`. */
const FROZEN_SHOWN = 230
/** Each tooth of the torn edge. */
const TOOTH = 12
/** Paper stays white with ink type in both modes. kit.ts has no fixed ink yet, so `--feta-avatar-ink` is spelled out. */
const PAPER = accent.onSolid
const INK = 'rgb(45,51,62)'
const SOFT_INK = 0.7
const RULE_INK = 0.35
/** A drawn code, not a scannable one: [x, width] per bar. */
const BARS = '0:2 3:3 8:2 12:1 15:1 17:2 21:3 25:3 30:2 34:3 39:1 41:3 45:3 50:1 52:1 55:3 60:2 63:1 66:1 69:2 72:2 76:2 79:1 81:2 84:2 88:1 90:3 94:2 97:3 102:1 105:3 110:1 112:1 114:2 117:3 122:1 125:2 128:3'
  .split(' ').map((bar) => bar.split(':').map(Number))

export type ReceiptState = 'idle' | 'printing' | 'hanging' | 'torn'

export type ReceiptLine = { quantity: number; name: string; price: number }

export type ReceiptPrinterProps = {
  shop?: string
  date?: string
  order?: string
  items?: ReceiptLine[]
  /** Percent. Default 8. */
  taxRate?: number
  currency?: string
  thanks?: ReactNode
  state?: ReceiptState
  defaultState?: ReceiptState
  onStateChange?: (state: ReceiptState) => void
  /** Stops the paper halfway out at `printing`, for documentation. */
  frozen?: boolean
  /** `false` shows the receipt complete and drops it without motion. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const ITEMS: ReceiptLine[] = [
  { quantity: 2, name: 'Flat white', price: 9 },
  { quantity: 1, name: 'Almond croissant', price: 3.8 },
  { quantity: 2, name: 'Oat milk', price: 1.2 },
  { quantity: 1, name: 'Banana bread', price: 3.2 },
]

const STATUS: Record<ReceiptState, string> = { idle: 'Ready', printing: 'Printing…', hanging: 'Pull down to tear', torn: 'Ready' }

/** A row of 12 wide teeth pointing up, or down along the bottom edge. */
function teeth(width: number, down: boolean): string {
  const count = Math.ceil(width / TOOTH)
  const base = down ? 0 : TOOTH / 2
  const tip = down ? TOOTH / 2 : 0
  let path = `M0 ${base}`
  for (let index = 0; index < count; index++) path += `L${index * TOOTH + TOOTH / 2} ${tip}L${(index + 1) * TOOTH} ${base}`
  return `${path}Z`
}

function Rule() {
  return (
    <Svg aria-hidden width="100%" height={1}>
      <Line x1={0} y1={0.5} x2="100%" y2={0.5} stroke={INK} opacity={RULE_INK} strokeWidth={1} strokeDasharray={[3, 3]} />
    </Svg>
  )
}

/** A receipt that prints out of an ink slot, hangs, and tears on a pull. */
export function ReceiptPrinter({
  shop = 'Feta Coffee', date = '14 Oct 2026 · 08:42', order = 'Order #4182', items = ITEMS, taxRate = 8, currency = '$', thanks = 'Thank you, come again',
  state, defaultState = 'idle', onStateChange, frozen = false, animated = true, style,
}: ReceiptPrinterProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultState)
  const [paper, setPaper] = useState({ width: 0, height: 0 })
  const current = state ?? held
  const lines = BASE_LINES + items.length

  const stateChange = useRef(onStateChange)
  stateChange.current = onStateChange
  const move = useCallback((next: ReceiptState): void => {
    setHeld(next)
    stateChange.current?.(next)
  }, [])

  const fed = useSharedValue(1)
  const paperHeight = useSharedValue(0)
  const x = useSharedValue(0)
  const y = useSharedValue(0)
  const rotate = useSharedValue(0)

  // Nothing feeds when still, so the paper arrives complete.
  useEffect(() => {
    if (still && current === 'printing' && !frozen) move('hanging')
  }, [still, current, frozen, move])

  // Paper comes out one line at a time, on a stepped clock, once its height is known.
  useEffect(() => {
    if (current !== 'printing') { fed.value = 1; return undefined }
    if (still) { fed.value = 1; return undefined }
    if (paper.height === 0) { fed.value = 0; return undefined }
    if (frozen) { fed.value = FROZEN_SHOWN / paper.height; return undefined }
    const steps = (progress: number): number => {
      'worklet'
      return Math.floor(progress * lines) / lines
    }
    fed.value = 0
    fed.value = withTiming(1, { duration: lines * LINE_MS, easing: steps }, (finished) => { if (finished) runOnJS(move)('hanging') })
    return () => cancelAnimation(fed)
  }, [current, fed, frozen, lines, move, paper.height, still])

  useEffect(() => {
    const torn = current === 'torn'
    const to = (value: number): number => (still ? value : withSpring(value, SETTLE))
    x.value = to(torn ? TORN.x : 0)
    y.value = to(torn ? TORN.y : 0)
    rotate.value = to(torn ? TORN.rotate : 0)
  }, [current, rotate, still, x, y])

  const hanging = current === 'hanging'
  const pan = useMemo(() => Gesture.Pan()
    .enabled(hanging && !still)
    .activeOffsetY([-4, 4])
    .onUpdate((event) => {
      const pull = event.translationY
      y.value = pull < 0 ? pull * PULL_ELASTIC : pull > PULL_LIMIT ? PULL_LIMIT + (pull - PULL_LIMIT) * PULL_ELASTIC : pull
    })
    .onEnd((event) => {
      if (event.translationY > PULL) runOnJS(move)('torn')
      else y.value = withSpring(0, SETTLE)
    }), [hanging, move, still, y])

  const feedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${rotate.value}deg` }] }))
  const paperStyle = useAnimatedStyle(() => ({ transform: [{ translateY: (fed.value - 1) * (paperHeight.value || 1000) }] }))

  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const tax = subtotal * (taxRate / 100)
  const printing = current === 'printing'

  return (
    <View style={[styles.printer, style]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">{shop}</Text>
          {current === 'torn'
            ? <Button style={SELF.center} contentStyle={styles.again} variant="link" size="sm" animated={animated} onPress={() => move('idle')}>Print again</Button>
            : <Text style={styles.status} accessibilityLiveRegion="polite">{STATUS[current]}</Text>}
        </View>
        <View style={styles.slot} />
      </View>
      <View style={styles.output}>
        {current === 'idle' ? null : (
          <GestureDetector gesture={pan}>
            <Animated.View style={[styles.feed, feedStyle]}>
              <Animated.View
                onLayout={(event) => {
                  const { width, height } = event.nativeEvent.layout
                  paperHeight.value = height
                  setPaper({ width, height })
                }}
                style={[styles.paper, paperStyle]}
              >
                {!printing && paper.width > 0 ? <Svg aria-hidden width={paper.width} height={TOOTH / 2} style={styles.edgeBottom}><Path d={teeth(paper.width, true)} fill={PAPER} /></Svg> : null}
                {current === 'torn' && paper.width > 0 ? <Svg aria-hidden width={paper.width} height={TOOTH / 2} style={styles.edgeTop}><Path d={teeth(paper.width, false)} fill={PAPER} /></Svg> : null}
                {hanging ? (
                  <Svg aria-hidden width="100%" height={1} style={styles.perforation}>
                    <Line x1={0} y1={0.5} x2="100%" y2={0.5} stroke={INK} opacity={SOFT_INK} strokeWidth={1} strokeDasharray={[2, 2]} />
                  </Svg>
                ) : null}
                <View style={styles.head}>
                  <Text style={styles.strong}>{shop.toUpperCase()}</Text>
                  <Text style={styles.soft}>{date}</Text>
                  <Text style={styles.soft}>{order}</Text>
                </View>
                <Rule />
                <View style={styles.lines}>
                  {items.map((item) => <View key={item.name} style={styles.line}><Text style={styles.ink}>{item.quantity} × {item.name}</Text><Text style={styles.ink}>{item.price.toFixed(2)}</Text></View>)}
                </View>
                <Rule />
                <View style={styles.lines}>
                  <View style={styles.line}><Text style={styles.soft}>Subtotal</Text><Text style={styles.soft}>{subtotal.toFixed(2)}</Text></View>
                  <View style={styles.line}><Text style={styles.soft}>Tax {taxRate}%</Text><Text style={styles.soft}>{tax.toFixed(2)}</Text></View>
                  <View style={styles.line}><Text style={styles.strong}>Total</Text><Text style={styles.strong}>{currency}{(subtotal + tax).toFixed(2)}</Text></View>
                </View>
                <Svg width={132} height={52} viewBox="0 0 132 52" style={styles.barcode} aria-hidden>
                  {BARS.map(([barX = 0, width = 1]) => <Rect key={barX} x={barX} width={width} height={52} fill={INK} />)}
                </Svg>
                <Text style={[styles.soft, styles.thanks]}>{thanks}</Text>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        )}
        {current === 'torn' ? null : (
          <View style={styles.action}>
            {hanging
              ? <Button shape="pill" size="lg" variant="secondary" animated={animated} onPress={() => move('torn')}>Tear receipt</Button>
              : <Button shape="pill" size="lg" status={printing ? 'loading' : 'idle'} animated={animated} onPress={() => move('printing')}>Print receipt</Button>}
          </View>
        )}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  printer: { backgroundColor: c.ink4, borderRadius: radius.tray, height: 608, maxWidth: 358, overflow: 'hidden', padding: space[1], width: '100%' },
  header: { backgroundColor: c.surface, borderColor: c.ink8, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, flexShrink: 0, gap: space[4.5], height: 78, paddingBottom: space[3.5], paddingHorizontal: space[5], paddingTop: space[5], zIndex: 2, boxShadow: softElevation(c) },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: space[2], height: 20, justifyContent: 'space-between' },
  title: type(14, c.textPrimary, '500'),
  status: type(14, c.textSecondary),
  again: { height: 20 },
  slot: { alignSelf: 'center', backgroundColor: c.ink8, borderRadius: radius.full, height: 6, width: '96%' },
  output: { flex: 1, minHeight: 0, overflow: 'hidden' },
  feed: { left: space[8], position: 'absolute', right: space[8], top: 0, transformOrigin: 'left top' },
  paper: { backgroundColor: PAPER, gap: space[3.5], padding: space[7], boxShadow: softElevation(c) },
  edgeBottom: { bottom: -TOOTH / 2, left: 0, position: 'absolute' },
  edgeTop: { left: 0, position: 'absolute', top: -TOOTH / 2 },
  perforation: { left: 0, position: 'absolute', right: 0, top: space[2] },
  head: { alignItems: 'center', gap: space[0.5] },
  ink: { ...type(14, INK), fontVariant: ['tabular-nums'], lineHeight: 18 },
  soft: { ...type(14, INK), fontVariant: ['tabular-nums'], lineHeight: 18, opacity: SOFT_INK },
  strong: { ...type(14, INK, '600'), fontVariant: ['tabular-nums'], lineHeight: 20 },
  lines: { gap: space[1] },
  line: { flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  barcode: { alignSelf: 'center' },
  thanks: { textAlign: 'center' },
  // A row, so the centring is on the main axis: Button sets its own alignSelf, which beat alignItems and sat it left.
  action: { bottom: space[7], flexDirection: 'row', justifyContent: 'center', left: 0, position: 'absolute', right: 0, zIndex: 1 },
})
