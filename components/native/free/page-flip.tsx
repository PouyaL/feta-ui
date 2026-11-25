import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeIn, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Polygon, Rect, Stop } from 'react-native-svg'
import { font, radius, space, useColors, useReduceMotion, type Colors } from '../kit'
import { withInk } from './button'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

/** Turn page: 700 ms in-out over the spine. */
const TURN = { duration: 700, easing: Easing.bezierFn(0.65, 0, 0.35, 1) }
/** Shade peak at 90 degrees, from the Turning frame. */
const SHADE_PEAK = 0.3
/** Single page books swing the leaf away instead of laying it on a left page. */
const SINGLE_ANGLE = -110
const SWIPE = 40
/** Below this width the book shows one page at a time. */
const SINGLE_WIDTH = 440
const PERSPECTIVE = 1000
const FOLD = { duration: 200, easing: Easing.bezierFn(0.23, 1, 0.32, 1) }
const FOLD_SIZE = 56
const fadeIn = FadeIn.duration(150).easing(Easing.bezierFn(0.23, 1, 0.32, 1))

export type PageFlipProps = {
  /** The cover is page 1. */
  cover: ReactNode
  /** Pages after the cover, numbered from 2. */
  pages: ReactNode[]
  /** The page shown: 0 is the cover. On a wide screen this picks the spread holding that page. */
  page?: number
  defaultPage?: number
  onPageChange?: (page: number) => void
  /** Holds a pose, for documentation. `peek` lifts the corner, and `turning` tilts the page over the spread. */
  pose?: 'peek' | 'turning'
  /** Default `Book`. */
  label?: string
  renderIcon: RenderIcon
  /** `false` turns pages at once. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Turn = { from: number; to: number; forward: boolean; target: number }

/** The shadow across a turning page. The ink stays dark in both modes. */
function Shadow({ id, x2, y2 }: { id: string; x2: number; y2: number }) {
  const colors = useColors()
  const ink = useColorScheme() === 'dark' ? colors.canvas : colors.inverse
  return (
    <Svg aria-hidden width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2={String(x2)} y2={String(y2)}>
          <Stop offset="0" stopColor={ink} stopOpacity={1} />
          <Stop offset="1" stopColor={ink} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  )
}

type LeafFaceProps = { angle: SharedValue<number>; clock: SharedValue<number>; back?: boolean; inverse?: boolean; fades?: boolean; forward: boolean; children: ReactNode }

/** Native views have no shared 3D space. The back of the leaf is drawn over the left page and hinges on its right edge, which is the same spine. */
function LeafFace({ angle, clock, back = false, inverse = false, fades = false, forward, children }: LeafFaceProps) {
  const styles = useThemed(createStyles)
  const turn = useAnimatedStyle(() => ({
    opacity: !fades ? 1 : forward ? interpolate(clock.value, [0, 0.5, 1], [1, 1, 0]) : interpolate(clock.value, [0, 0.5, 1], [0, 1, 1]),
    transform: [{ perspective: PERSPECTIVE }, { rotateY: `${angle.value + (back ? 180 : 0)}deg` }],
  }))
  const shade = useAnimatedStyle(() => ({ opacity: interpolate(clock.value, [0, 0.5, 1], [0, SHADE_PEAK, 0]) }))
  return (
    <Animated.View style={[styles.face, back ? styles.faceBack : styles.faceFront, inverse && styles.inverse, turn]}>
      {children}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, shade]}><Shadow id="leaf-shade" x2={1} y2={0} /></Animated.View>
    </Animated.View>
  )
}

function Corner({ peek, still, onPress }: { peek: boolean; still: boolean; onPress: () => void }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const fold = useSharedValue(peek ? 1 : 0)
  const to = (value: number): void => { fold.value = still ? value : withTiming(value, FOLD) }
  useEffect(() => {
    fold.value = still ? (peek ? 1 : 0) : withTiming(peek ? 1 : 0, FOLD)
  }, [fold, peek, still])
  const foldStyle = useAnimatedStyle(() => ({ transform: [{ scale: fold.value }] }))
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Turn the page" style={styles.corner} onPress={onPress} onPressIn={() => to(1)} onPressOut={() => to(peek ? 1 : 0)}>
      <Animated.View style={[styles.fold, foldStyle]}>
        <Svg aria-hidden width={FOLD_SIZE} height={FOLD_SIZE}><Polygon points={`${FOLD_SIZE},0 0,${FOLD_SIZE} ${FOLD_SIZE * 0.08},${FOLD_SIZE * 0.08}`} fill={colors.muted} /></Svg>
      </Animated.View>
    </Pressable>
  )
}

/** A book you leaf through: spreads on a wide screen, one page on a phone. */
export function PageFlip({ cover, pages, page, defaultPage = 0, onPageChange, pose, label = 'Book', renderIcon, animated = true, style }: PageFlipProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const reduced = useReduceMotion()
  const fades = reduced && animated
  const [single, setSingle] = useState(true)
  const [held, setHeld] = useState(defaultPage)
  const [turn, setTurn] = useState<Turn | null>(null)
  const all = [cover, ...pages]
  const total = all.length

  const current = page ?? held
  // On a wide screen a spread is an index: 0 is the cover, 1 is pages 2 and 3.
  const at = single ? current : Math.ceil(current / 2)
  const last = single ? total - 1 : Math.ceil((total - 1) / 2)
  const left = (spread: number): ReactNode => (single || spread === 0 ? null : all[spread * 2 - 1] ?? null)
  const right = (spread: number): ReactNode => (single ? all[spread] : all[spread * 2]) ?? null
  const counter = (spread: number): string => {
    if (single) return `${spread + 1} of ${total}`
    if (spread === 0) return `1 of ${total}`
    const first = spread * 2
    return first + 1 > total ? `${first} of ${total}` : `${first}–${first + 1} of ${total}`
  }
  const toPage = (spread: number): number => (single ? spread : Math.min(spread * 2, total - 1))

  const clock = useSharedValue(0)
  const laid = single ? SINGLE_ANGLE : -180
  const angle = useSharedValue(0)
  const pageChange = useRef(onPageChange)
  pageChange.current = onPageChange

  function go(next: number): void {
    if (next < 0 || next > last || turn) return
    if (still) {
      setHeld(toPage(next))
      onPageChange?.(toPage(next))
      return
    }
    setTurn({ from: at, to: next, forward: next > at, target: toPage(next) })
  }

  const finish = useCallback((target: number): void => {
    setHeld(target)
    pageChange.current?.(target)
    setTurn(null)
  }, [])

  useEffect(() => {
    if (!turn) return
    const { target } = turn
    angle.value = turn.forward ? 0 : laid
    clock.value = 0
    clock.value = withTiming(1, { duration: TURN.duration, easing: Easing.linear })
    angle.value = withTiming(turn.forward ? laid : 0, TURN, (finished) => { if (finished) runOnJS(finish)(target) })
  }, [angle, clock, finish, laid, turn])

  const goRef = useRef(go)
  goRef.current = go
  const atRef = useRef(at)
  atRef.current = at
  const step = useCallback((by: number) => goRef.current(atRef.current + by), [])

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!still)
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE) runOnJS(step)(event.translationX < 0 ? 1 : -1)
    }), [step, still])

  // During a turn the spread under the leaf already shows what lands.
  const underLeft = turn ? left(turn.forward ? turn.from : turn.to) : left(at)
  const underRight = turn ? right(turn.forward ? turn.to : turn.from) : right(at)
  const leafFront = turn ? right(turn.forward ? turn.from : turn.to) : null
  const leafBack = turn ? left(turn.forward ? turn.to : turn.from) : null
  const peeking = pose === 'peek' && !turn
  const coverShown = at === 0 && !turn
  const quiet = pose === 'turning'
  const entering = fades ? { entering: fadeIn } : {}

  return (
    <Card
      animated={animated}
      style={[styles.flip, style]}
      bodyStyle={styles.body}
      footerStyle={styles.footer}
      footer={
        <>
          <Text style={styles.counter} accessibilityLiveRegion="polite">{counter(turn ? turn.to : at)}</Text>
          <View style={styles.nav}>
            <IconButton variant="secondary" size="sm" icon={renderIcon('chevron-left', 16)} label="Previous page" disabled={at === 0} animated={animated} onPress={() => go(at - 1)} />
            <IconButton variant="secondary" size="sm" icon={renderIcon('chevron-right', 16)} label="Next page" disabled={at === last} animated={animated} onPress={() => go(at + 1)} />
          </View>
        </>
      }
    >
      <GestureDetector gesture={pan}>
        <View
          accessibilityLabel={label}
          onLayout={(event) => setSingle(event.nativeEvent.layout.width < SINGLE_WIDTH)}
          style={[styles.spread, single && styles.spreadSingle]}
        >
          {single ? null : <View style={styles.slot}>{underLeft ? <Animated.View key={String(at)} {...entering} style={styles.page}>{underLeft}</Animated.View> : null}</View>}
          <View style={styles.slot}>
            {underRight ? (
              <Animated.View key={String(at)} {...entering} style={[styles.page, coverShown && styles.inverse]}>
                <View style={[styles.quiet, quiet && styles.quietOn]}>{underRight}</View>
                {quiet ? (
                  <View style={styles.tilt} aria-hidden>
                    {underRight}
                    <View pointerEvents="none" style={styles.tiltShade}><Shadow id="tilt-shade" x2={1} y2={1} /></View>
                  </View>
                ) : null}
                {!turn && at !== last ? <Corner peek={peeking} still={still} onPress={() => go(at + 1)} /> : null}
              </Animated.View>
            ) : null}
          </View>
          {turn ? (
            <View key={`${turn.from}-${turn.to}`} pointerEvents="none" aria-hidden style={[styles.leaf, single && styles.leafSingle]}>
              {single ? null : <LeafFace angle={angle} clock={clock} back forward={turn.forward}>{leafBack}</LeafFace>}
              <LeafFace angle={angle} clock={clock} inverse={(turn.forward ? turn.from : turn.to) === 0} fades={single} forward={turn.forward}>{leafFront}</LeafFace>
            </View>
          ) : null}
        </View>
      </GestureDetector>
    </Card>
  )
}

export type BookCoverProps = { kicker?: ReactNode; title: ReactNode; hint?: ReactNode; renderIcon: RenderIcon }

/** The inverse cover. */
export function BookCover({ kicker, title, hint = 'Turn the corner', renderIcon }: BookCoverProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  return (
    <View style={styles.cover}>
      {kicker ? <Text style={styles.coverKicker}>{kicker}</Text> : null}
      <Text style={styles.coverTitle} accessibilityRole="header">{title}</Text>
      <View style={styles.coverFoot}>{withInk(renderIcon('book-open', 14), colors.textInverse)}<Text style={styles.coverHint}>{hint}</Text></View>
    </View>
  )
}

export type BookPageProps = {
  kicker?: ReactNode
  heading?: ReactNode
  /** Page number at the foot. */
  folio?: number
  /** Which side the folio sits on. Default `end`. */
  folioSide?: 'start' | 'end'
  children?: ReactNode
}

/** One inset page: kicker, optional heading, content and a folio. */
export function BookPage({ kicker, heading, folio, folioSide = 'end', children }: BookPageProps) {
  const styles = useThemed(createStyles)
  return (
    <View style={styles.sheet} accessibilityLabel={folio ? `Page ${folio}` : undefined}>
      {kicker ? <Text style={styles.small}>{kicker}</Text> : null}
      {heading ? <Text style={styles.heading} accessibilityRole="header">{heading}</Text> : null}
      {children}
      {folio ? <Text style={[styles.small, styles.folio, folioSide === 'end' && styles.folioEnd]}>{folio}</Text> : null}
    </View>
  )
}

/** A menu line: name, price leader, price and a note. */
export function BookDish({ name, price, note }: { name: ReactNode; price: ReactNode; note?: ReactNode }) {
  const styles = useThemed(createStyles)
  return (
    <View style={styles.dish}>
      <View style={styles.dishRow}><Text style={styles.dishName}>{name}</Text><View style={styles.leader} /><Text style={styles.price}>{price}</Text></View>
      {note ? <Text style={styles.small}>{note}</Text> : null}
    </View>
  )
}

/** A label and value row. */
export function BookRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  const styles = useThemed(createStyles)
  return <View style={styles.row}><Text style={styles.small}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>
}

/** Body copy for a page. */
export function BookText({ children }: { children: ReactNode }) {
  const styles = useThemed(createStyles)
  return <Text style={styles.text}>{children}</Text>
}

const createStyles = (c: Colors) => StyleSheet.create({
  flip: { maxWidth: 672, width: '100%' },
  body: { backgroundColor: 'transparent', borderRadius: 0, borderWidth: 0, overflow: 'visible', padding: 0 },
  footer: { justifyContent: 'space-between', paddingBottom: space[1], paddingLeft: space[3], paddingRight: space[1.5], paddingTop: space[1.5] },
  counter: { color: c.textTertiary, fontFamily: font.mono, fontSize: 12 },
  nav: { flexDirection: 'row', gap: space[1] },
  spread: { borderRadius: radius.card, flexDirection: 'row', height: 472, padding: space[2] },
  spreadSingle: { height: 496, overflow: 'hidden' },
  slot: { flex: 1, minWidth: 0 },
  page: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, height: '100%' },
  inverse: { backgroundColor: c.inverse, borderWidth: 0 },
  quiet: { height: '100%' },
  quietOn: { opacity: 0.35 },
  // The Turning frame: the page tilted 6 degrees with a shade.
  tilt: { ...StyleSheet.absoluteFill, backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', transform: [{ translateY: -6 }, { rotate: '-6deg' }], transformOrigin: 'left top', zIndex: 2 },
  tiltShade: { ...StyleSheet.absoluteFill, opacity: SHADE_PEAK },
  // The leaf hinges on the spine, which is the page's left edge.
  leaf: { bottom: space[2], left: '50%', position: 'absolute', right: space[2], top: space[2], zIndex: 3 },
  leafSingle: { left: space[2] },
  face: { backfaceVisibility: 'hidden', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, bottom: 0, overflow: 'hidden', position: 'absolute', top: 0, width: '100%' },
  faceFront: { left: 0, transformOrigin: 'left center' },
  faceBack: { right: '100%', transformOrigin: 'right center' },
  corner: { borderBottomRightRadius: radius.control, bottom: 0, height: 72, position: 'absolute', right: 0, width: 72, zIndex: 1 },
  fold: { bottom: 0, height: FOLD_SIZE, position: 'absolute', right: 0, transformOrigin: 'right bottom', width: FOLD_SIZE },
  sheet: { flex: 1, gap: space[3.5], paddingBottom: space[6], paddingHorizontal: space[7], paddingTop: space[7] },
  small: type(12, c.textTertiary),
  heading: { ...type(24, c.textPrimary, '600'), lineHeight: 32 },
  text: { ...type(12, c.textSecondary), lineHeight: 20, marginBottom: space[5] },
  folio: { marginTop: 'auto' },
  folioEnd: { textAlign: 'right' },
  dish: { gap: space[0.5] },
  dishRow: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  dishName: type(14, c.textPrimary, '500'),
  leader: { backgroundColor: c.ink10, flex: 1, height: StyleSheet.hairlineWidth },
  price: { color: c.textPrimary, fontFamily: font.mono, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  row: { flexDirection: 'row', gap: space[3], justifyContent: 'space-between' },
  rowValue: type(12, c.textPrimary, '500'),
  cover: { flex: 1, gap: space[2.5], paddingBottom: space[7], paddingHorizontal: space[7], paddingTop: space[8] },
  coverKicker: { ...type(12, c.textInverse), opacity: 0.6 },
  coverTitle: { ...type(30, c.textInverse, '600'), lineHeight: 36 },
  coverFoot: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], marginTop: 'auto', opacity: 0.6 },
  coverHint: type(12, c.textInverse),
})
