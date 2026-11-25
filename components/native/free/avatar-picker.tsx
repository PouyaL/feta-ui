import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Circle, Line } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Avatar, AvatarPhoto, type AvatarPerson } from './avatar'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { Field } from './field'
import { IconButton } from './icon-button'
import { Input } from './input'

const COIN_SPRING = { stiffness: 140, damping: 22 } as const
const PICK_SPRING = { duration: 300, dampingRatio: 0.7 } as const
const FLIP = 180
const DRAG_DEG_PER_POINT = 1.1
const THROW_MS = 160
const STILL_SWIPE = 8
const BEZEL = 176
const TICKS = 60
const SHADE_MAX = 0.4

export type AvatarOption = { person: AvatarPerson; name: string }

export type AvatarPickerProps = {
  options: AvatarOption[]
  title?: string
  hint?: string
  spinningHint?: string
  defaultName?: string
  /** Fires when Continue is pressed. */
  onContinue?: (choice: { person: AvatarPerson; name: string }) => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const wrap = (index: number, length: number): number => ((index % length) + length) % length

/** A coin that spins on real physics and settles on a face. */
export function AvatarPicker({ options, title = 'Pick your avatar', hint = 'Spin the coin or pick a face.', spinningHint = 'Spinning… let go to land on a face.', defaultName, onContinue, renderIcon, animated = true, style }: AvatarPickerProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const count = options.length
  const rotate = useSharedValue(0)
  const from = useSharedValue(0)
  const badge = useSharedValue(0)
  const [turn, setTurn] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [picked, setPicked] = useState(false)
  const [name, setName] = useState(defaultName ?? '')
  const [edited, setEdited] = useState(defaultName !== undefined)
  const index = wrap(turn, count)
  const current = options[index]
  const shownName = edited ? name : current?.name ?? ''

  useAnimatedReaction(() => Math.round(rotate.value / FLIP), (next, last) => { if (next !== last) runOnJS(setTurn)(next) })

  useEffect(() => {
    if (!picked) return
    badge.value = still ? 1 : withSpring(1, PICK_SPRING)
  }, [picked, still, badge])

  function land(target: number): void {
    setSpinning(false)
    setPicked(true)
    rotate.value = still ? target * FLIP : withSpring(target * FLIP, COIN_SPRING)
  }
  const step = (by: number): void => land(Math.round(rotate.value / FLIP) + by)
  function choose(at: number): void {
    const now = Math.round(rotate.value / FLIP)
    land(now + ((at - wrap(now, count) + count) % count))
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-4, 4])
    .failOffsetY([-12, 12])
    .onBegin(() => { from.value = rotate.value })
    .onStart(() => { runOnJS(setSpinning)(true) })
    .onUpdate((e) => { if (!still) rotate.value = from.value + e.translationX * DRAG_DEG_PER_POINT })
    .onEnd((e) => {
      if (still) {
        if (Math.abs(e.translationX) > STILL_SWIPE) runOnJS(step)(e.translationX > 0 ? 1 : -1)
        else runOnJS(setSpinning)(false)
        return
      }
      // The flick carries on for a moment, then the spring takes the nearest face.
      const thrown = rotate.value + (e.velocityX / 1000) * THROW_MS * DRAG_DEG_PER_POINT
      runOnJS(land)(Math.round(thrown / FLIP))
    })

  const coinFront = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateY: `${rotate.value}deg` }] }))
  const coinBack = useAnimatedStyle(() => ({ transform: [{ perspective: 800 }, { rotateY: `${rotate.value + FLIP}deg` }] }))
  const shade = useAnimatedStyle(() => ({ opacity: Math.abs(Math.sin((rotate.value * Math.PI) / 180)) * SHADE_MAX }))
  const pop = useAnimatedStyle(() => ({ opacity: interpolate(badge.value, [0, 0.2], [0, 1]), transform: [{ scale: badge.value }] }))

  const face = (offset: number): AvatarPerson | null => options[wrap(turn + offset, count)]?.person ?? null
  const even = turn % 2 === 0
  const front = even ? face(0) : face(1)
  const back = even ? face(1) : face(0)
  const empty = edited && name.trim() === ''
  const side = (person: AvatarPerson | null) => (empty ? renderIcon('user', 44) : person ? <AvatarPhoto person={person} /> : null)
  const c = BEZEL / 2

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{spinning ? spinningHint : hint}</Text>
        <View style={styles.stage}>
          <View style={styles.bezel}>
            <Svg aria-hidden width={BEZEL} height={BEZEL}>
              <Circle cx={c} cy={c} r={c} fill={colors.ink4} />
              {Array.from({ length: TICKS }, (_, i) => <Line key={i} x1={c} y1={0} x2={c} y2={6} stroke={colors.ink8} transform={`rotate(${i * 6} ${c} ${c})`} />)}
              <Line x1={c} y1={3} x2={c} y2={10} stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </View>
          <GestureDetector gesture={pan}>
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Avatar"
              aria-valuemin={1}
              aria-valuemax={count}
              aria-valuenow={index + 1}
              aria-valuetext={current?.name ?? ''}
              accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
              onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
              style={styles.coin}
            >
              <Animated.View style={[styles.side, empty ? styles.sideEmpty : null, coinFront]}>{side(front)}</Animated.View>
              <Animated.View style={[styles.side, empty ? styles.sideEmpty : null, coinBack]}>{side(back)}</Animated.View>
              <Animated.View pointerEvents="none" style={[styles.shade, shade]} />
            </View>
          </GestureDetector>
          {picked && !empty ? <Animated.View accessible accessibilityRole="image" accessibilityLabel="Picked" style={[styles.badge, pop]}>{renderIcon('tick-02', 14)}</Animated.View> : null}
        </View>
        <View style={styles.caption}>
          <Text style={styles.captionName}>{empty ? 'Add your name' : shownName}</Text>
          <Text style={styles.number}>No. {String(index + 1).padStart(3, '0')}</Text>
        </View>
        <View accessibilityRole="radiogroup" accessibilityLabel="Faces" style={styles.options}>
          {options.map((option, i) => (
            <Pressable key={option.person} accessibilityRole="radio" accessibilityLabel={option.name} aria-checked={i === index} onPress={() => choose(i)} style={styles.option}>
              {i === index ? <View style={styles.ring} /> : null}
              <Avatar person={option.person} size="md" animated={animated} />
            </Pressable>
          ))}
          <View style={styles.spacer} />
          <IconButton variant="secondary" size="sm" icon={renderIcon('dice', 16)} label="Shuffle" animated={animated} onPress={() => step(1 + Math.floor(Math.random() * Math.max(1, count - 1)))} />
        </View>
        <Field label="Display name">
          <Input value={shownName} placeholder="Your name" onChangeText={(text: string) => { setEdited(true); setName(text) }} />
        </Field>
      </View>
      <Button animated={animated} style={styles.continue} disabled={shownName.trim() === '' || spinning} trailingIcon={renderIcon('arrow-right', 16)} onPress={() => { if (current) onContinue?.({ person: current.person, name: shownName.trim() }) }}>Continue</Button>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', maxWidth: 360, gap: space[1], padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  // Full width, as on the web.
  continue: { alignSelf: 'stretch' },
  card: { gap: space[3], paddingTop: space[6], paddingHorizontal: space[5], paddingBottom: space[5], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  title: { ...type(16, c.textPrimary, '600'), textAlign: 'center' },
  hint: { ...type(12, c.textSecondary), marginTop: -space[2], minHeight: 16, textAlign: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center', height: BEZEL },
  bezel: { position: 'absolute', width: BEZEL, height: BEZEL },
  coin: { width: 128, height: 128, borderRadius: radius.full },
  side: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radius.full, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.muted, backfaceVisibility: 'hidden' },
  sideEmpty: { backgroundColor: c.muted },
  shade: { ...StyleSheet.absoluteFill, borderRadius: radius.full, backgroundColor: c.inverse },
  badge: { position: 'absolute', top: '50%', left: '50%', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, marginTop: 36, marginLeft: 36, borderWidth: 2, borderColor: c.surface, borderRadius: radius.full, backgroundColor: c.success },
  caption: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: space[2] },
  captionName: type(14, c.textPrimary, '500'),
  number: type(12, c.textTertiary, '400', true),
  options: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  option: { alignItems: 'center', justifyContent: 'center', width: 44, height: 44 },
  ring: { position: 'absolute', top: 2, right: 2, bottom: 2, left: 2, borderRadius: radius.full, borderWidth: 2, borderColor: c.textPrimary },
  spacer: { flex: 1 },
})
