import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { font, radius, space, useColors, useReduceMotion, type Colors } from '../kit'
import { Badge } from './badge'
import { Button } from './button'
import { Card, QrArt, type RenderIcon, type, useStill, useThemed } from './card'
import { Separator } from './separator'

/** Card flip: 600 ms, spring 0.2. */
const FLIP = { duration: 600, dampingRatio: 0.8 } as const
const FADE = { duration: 150, easing: Easing.bezierFn(0.23, 1, 0.32, 1) }
const FACE_HEIGHT = 372
const PERSPECTIVE = 1000
/** `--feta-effect-scrim`. */
const SCRIM_ALPHA = 0.55

export type FlipSide = 'front' | 'back'

export type Ticket = {
  kicker: string
  tier: string
  volume: string
  event: string
  date: string
  doors: string
  venue: string
  holder: string
  number: string
  gate: string
  section: string
  row: string
  seat: string
  terms: string
}

export type CardFlipProps = {
  /** `turning` holds the mid flip pose. Leave it out to keep the side here. */
  side?: FlipSide | 'turning'
  defaultSide?: FlipSide
  onSideChange?: (side: FlipSide) => void
  ticket?: Ticket
  /** Replaces the ticket front. */
  front?: ReactNode
  /** Replaces the ticket back. It must be the same size. */
  back?: ReactNode
  renderIcon: RenderIcon
  /** `false` swaps the sides at once. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const TICKET: Ticket = {
  kicker: 'Admit one', tier: 'GA', volume: 'Vol. 04', event: 'Fieldwork Sessions', date: 'Sat 21 Nov', doors: '19:30', venue: 'Hall B, Pier 7', holder: 'Jordan Vale',
  number: '004182', gate: 'C', section: 'Floor', row: 'F', seat: '14', terms: 'Valid for one entry. Re-entry is not permitted.',
}

function Datum({ label, value }: { label: string; value: string }) {
  const styles = useThemed(createStyles)
  return <View style={styles.datum}><Text style={styles.label}>{label}</Text><Text style={styles.value} numberOfLines={1}>{value}</Text></View>
}

function TicketFront({ ticket, animated }: { ticket: Ticket; animated: boolean }) {
  const styles = useThemed(createStyles)
  return (
    <View style={styles.front}>
      <View style={styles.frontHead}><Text style={styles.label}>{ticket.kicker}</Text><Badge size="sm" mark={false} animated={animated}>{ticket.tier}</Badge></View>
      <View style={styles.art}><Text style={styles.label}>{ticket.volume}</Text><Text style={styles.event} numberOfLines={1} accessibilityRole="header">{ticket.event}</Text></View>
      <View style={styles.details}><Datum label="Date" value={ticket.date} /><Datum label="Doors" value={ticket.doors} /><Datum label="Venue" value={ticket.venue} /></View>
      <Separator animated={animated} />
      <View style={styles.holder}><Datum label="Holder" value={ticket.holder} /><Text style={styles.mono}>No. {ticket.number}</Text></View>
    </View>
  )
}

function TicketBack({ ticket }: { ticket: Ticket }) {
  const styles = useThemed(createStyles)
  return (
    <View style={[styles.front, styles.back]}>
      <Text style={styles.label}>Scan at entry</Text>
      <View style={styles.qr}><QrArt seed={ticket.number} size={96} /></View>
      <Text style={styles.number}>#{ticket.number}</Text>
      <View style={styles.seat}><Datum label="Gate" value={ticket.gate} /><Datum label="Section" value={ticket.section} /><Datum label="Row" value={ticket.row} /><Datum label="Seat" value={ticket.seat} /></View>
      <Text style={styles.terms}>{ticket.terms}</Text>
    </View>
  )
}

type FaceProps = { rotate: SharedValue<number>; offset: number; on: boolean; children: ReactNode }

/** Native views have no shared 3D space, so each side turns on its own and the back starts half a turn on. */
function Face({ rotate, offset, on, children }: FaceProps) {
  const styles = useThemed(createStyles)
  const dark = useColorScheme() === 'dark'
  const turn = useAnimatedStyle(() => ({ transform: [{ perspective: PERSPECTIVE }, { rotateY: `${rotate.value + offset}deg` }] }))
  const shade = useAnimatedStyle(() => ({ opacity: Math.sin(Math.min(rotate.value, 180) * Math.PI / 180) ** 2 * SCRIM_ALPHA }))
  return (
    <Animated.View
      accessibilityElementsHidden={!on}
      importantForAccessibility={on ? 'auto' : 'no-hide-descendants'}
      pointerEvents={on ? 'auto' : 'none'}
      style={[styles.face, turn]}
    >
      {children}
      <Animated.View pointerEvents="none" style={[styles.shade, dark && styles.shadeDark, shade]} />
    </Animated.View>
  )
}

/** Reduced motion crossfades the sides in 150 ms, and `animated={false}` swaps them at once. */
function FadeFace({ on, fades, children }: { on: boolean; fades: boolean; children: ReactNode }) {
  const shown = useSharedValue(on ? 1 : 0)
  useEffect(() => {
    shown.value = fades ? withTiming(on ? 1 : 0, FADE) : on ? 1 : 0
  }, [fades, on, shown])
  const fade = useAnimatedStyle(() => ({ opacity: shown.value }))
  return (
    <Animated.View
      accessibilityElementsHidden={!on}
      importantForAccessibility={on ? 'auto' : 'no-hide-descendants'}
      pointerEvents={on ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, fade]}
    >
      {children}
    </Animated.View>
  )
}

/** The Turning pose: the shade runs across the front at 125 degrees. */
function HeldShade() {
  const colors = useColors()
  const dark = useColorScheme() === 'dark'
  const ink = dark ? colors.canvas : colors.inverse
  return (
    <Svg aria-hidden width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="held-shade" x1="0" y1="0.1" x2="1" y2="0.9">
          <Stop offset="0" stopColor={ink} stopOpacity={0} />
          <Stop offset="1" stopColor={ink} stopOpacity={SCRIM_ALPHA} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#held-shade)" />
    </Svg>
  )
}

/** A ticket that turns in 3D. Both sides are the same size, and the shade peaks halfway round. */
export function CardFlip({ side, defaultSide = 'front', onSideChange, ticket = TICKET, front, back, renderIcon, animated = true, style }: CardFlipProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const reduce = useReduceMotion()
  const [own, setOwn] = useState<FlipSide>(defaultSide)
  const [flipping, setFlipping] = useState(false)
  const held = side === 'turning'
  const current: FlipSide = side === 'front' || side === 'back' ? side : own
  const rotate = useSharedValue(current === 'back' ? 180 : 0)

  useEffect(() => {
    const target = current === 'back' ? 180 : 0
    if (rotate.value === target) return
    if (still) { rotate.value = target; return }
    setFlipping(true)
    rotate.value = withSpring(target, FLIP, (finished) => { if (finished) runOnJS(setFlipping)(false) })
  }, [current, rotate, still])

  const shown = useRef(current)
  useEffect(() => {
    if (shown.current === current) return
    shown.current = current
    AccessibilityInfo.announceForAccessibility(`Showing the ${current}`)
  }, [current])

  function flip(): void {
    const next: FlipSide = current === 'front' ? 'back' : 'front'
    setOwn(next)
    onSideChange?.(next)
  }

  const busy = held || flipping
  const target = current === 'front' ? 'back' : 'front'
  const meta = busy ? 'Turning' : `${current === 'front' ? 'Front' : 'Back'} · tap to flip`
  const faceFront = front ?? <TicketFront ticket={ticket} animated={animated} />
  const faceBack = back ?? <TicketBack ticket={ticket} />

  return (
    <Card
      animated={animated}
      style={[styles.flip, style]}
      bodyStyle={styles.stage}
      footerStyle={styles.footer}
      footer={
        <>
          <Text style={styles.meta}>{meta}</Text>
          <Button size="sm" variant="secondary" contentStyle={busy ? styles.busy : undefined} leadingIcon={renderIcon('flip-horizontal', 16)} accessibilityLabel={`Flip to the ${target}`} animated={animated} onPress={flip}>Flip</Button>
        </>
      }
    >
      <View style={styles.scene}>
        {held ? (
          <>
            <View style={[styles.layer, styles.heldBack]}>{faceBack}</View>
            <View style={[styles.layer, styles.heldFront]}>{faceFront}<HeldShade /></View>
          </>
        ) : (
          <Pressable accessible={false} tabIndex={-1} importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={flip}>
            {still ? (
              <>
                <FadeFace on={current === 'front'} fades={reduce && animated}>{faceFront}</FadeFace>
                <FadeFace on={current === 'back'} fades={reduce && animated}>{faceBack}</FadeFace>
              </>
            ) : (
              <>
                <Face rotate={rotate} offset={0} on={current === 'front'}>{faceFront}</Face>
                <Face rotate={rotate} offset={180} on={current === 'back'}>{faceBack}</Face>
              </>
            )}
          </Pressable>
        )}
        {busy ? <View pointerEvents="none" style={styles.hintRow}><Text style={styles.hint}>Flipping to the {target}</Text></View> : null}
      </View>
    </Card>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  flip: { maxWidth: 320, width: '100%' },
  label: type(12, c.textTertiary),
  value: { ...type(14, c.textPrimary, '600'), lineHeight: 20 },
  mono: { color: c.textTertiary, fontFamily: font.mono, fontSize: 12 },
  datum: { flexShrink: 1, gap: space[0.5], minWidth: 0 },
  // The stage replaces the inset card, so each side can be its own.
  stage: { backgroundColor: 'transparent', borderWidth: 0, overflow: 'visible', padding: 0 },
  scene: { height: FACE_HEIGHT },
  front: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, height: FACE_HEIGHT, paddingBottom: space[4], paddingHorizontal: space[4.5], paddingTop: space[4.5] },
  frontHead: { alignItems: 'center', flexDirection: 'row', height: 20, justifyContent: 'space-between' },
  art: { flexShrink: 0, gap: space[1], height: 150, justifyContent: 'flex-end', paddingVertical: space[4] },
  event: { ...type(26, c.textPrimary, '600'), lineHeight: 34 },
  details: { flexDirection: 'row', gap: space[4], height: 52, paddingBottom: space[3.5] },
  holder: { alignItems: 'flex-end', flexDirection: 'row', height: 52, justifyContent: 'space-between', paddingTop: space[3.5] },
  back: { alignItems: 'center', gap: space[3.5] },
  qr: { alignItems: 'center', backgroundColor: c.muted, borderRadius: radius['2xl'], flexShrink: 0, height: 120, justifyContent: 'center', width: 120 },
  number: { color: c.textPrimary, fontFamily: font.mono, fontSize: 14, lineHeight: 20 },
  seat: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space[1.5] },
  terms: { ...type(12, c.textTertiary), textAlign: 'center' },
  face: { ...StyleSheet.absoluteFill, backfaceVisibility: 'hidden', borderRadius: radius.card, overflow: 'hidden' },
  shade: { ...StyleSheet.absoluteFill, backgroundColor: c.inverse },
  shadeDark: { backgroundColor: c.canvas },
  layer: { ...StyleSheet.absoluteFill },
  heldBack: { transform: [{ translateX: 11 }, { translateY: 4 }, { rotate: '6deg' }] },
  heldFront: { borderRadius: radius.card, overflow: 'hidden', transform: [{ translateX: -6 }, { translateY: -6 }, { rotate: '-5deg' }] },
  hintRow: { alignItems: 'center', bottom: space[2], left: 0, position: 'absolute', right: 0 },
  hint: { ...type(12, c.textInverse, '500'), backgroundColor: c.inverse, borderRadius: radius.full, overflow: 'hidden', paddingHorizontal: space[3], paddingVertical: space[1.5] },
  footer: { justifyContent: 'space-between', paddingBottom: space[1], paddingLeft: space[3], paddingRight: space[1], paddingTop: space[2] },
  meta: type(12, c.textTertiary),
  busy: { backgroundColor: c.ink10 },
})
