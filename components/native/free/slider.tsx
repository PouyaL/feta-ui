import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type AccessibilityActionEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { Easing, FadeInDown, FadeOut, interpolate, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import { font, radius, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const TIP_HIDE_MS = 300
const TIP_MS = 160
const FOCUS_MS = 120
const TICK_EVERY = 7
const GRAB_RADIUS = 22
const JUMP = { stiffness: 500, damping: 34, mass: 1 } as const
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)

/** Bold keeps its knob inside the fill: both ends of the range sit one cap radius in. */
const LOOK = {
  line: { thumb: 18, pad: 9, track: 6, height: 44 },
  bold: { thumb: 22, pad: 16, track: 32, height: 44 },
  field: { thumb: 2, pad: 0, track: 44, height: 44 },
} as const

export type SliderProps = {
  /** One number, or two for a range. Every style takes both. */
  value?: number | [number, number]
  defaultValue?: number | [number, number]
  onValueChange?: (value: number | [number, number]) => void
  min?: number
  max?: number
  step?: number
  /** `line` for forms, `bold` for one headline value, `field` for dense inspectors. Default `line`. */
  styleKind?: 'line' | 'bold' | 'field'
  /** The accessible name. `field` also shows it inside the row. */
  label: string
  /** Formats the value in the tip and for screen readers. */
  format?: (value: number) => string
  /** `vertical` stands the slider up, `length` tall. */
  orientation?: 'horizontal' | 'vertical'
  length?: number
  /** Keeps the value tip showing. */
  alwaysTip?: boolean
  /** Ticks along a `bold` slider. */
  ticks?: boolean
  disabled?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const clamp = (value: number, low: number, high: number): number => {
  'worklet'
  return Math.min(high, Math.max(low, value))
}

type ThumbProps = {
  index: number
  at: SharedValue<number>
  size: SharedValue<number>
  active: SharedValue<number>
  pad: number
  thumb: number
  kind: NonNullable<SliderProps['styleKind']>
  vertical: boolean
  label: string
  text: string
  low: number
  high: number
  now: number
  tip: boolean
  still: boolean
  disabled: boolean
  onStep: (index: number, up: boolean) => void
}

function Thumb({ index, at, size, active, pad, thumb, kind, vertical, label, text, low, high, now, tip, still, disabled, onStep }: ThumbProps) {
  const styles = useThemed(createStyles)
  const grown = useSharedValue(0)

  const place = useAnimatedStyle(() => {
    const center = pad + at.value * Math.max(0, size.value - pad * 2)
    return { transform: [vertical ? { translateY: -center + thumb / 2 } : { translateX: center - thumb / 2 }] }
  })
  useAnimatedReaction(() => active.value === index, (on) => {
    grown.value = still ? (on ? 1 : 0) : withTiming(on ? 1 : 0, { duration: FOCUS_MS })
  }, [index, still])
  const hold = useAnimatedStyle(() => ({ transform: [{ scale: kind === 'line' ? 1 + grown.value * (4 / thumb) : 1 }] }))
  const halo = useAnimatedStyle(() => ({ opacity: grown.value, transform: [{ scale: interpolate(grown.value, [0, 1], [0.6, 1]) }] }))

  return (
    <Animated.View
      accessible
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      accessibilityLabel={label}
      accessibilityRole="adjustable"
      aria-disabled={disabled}
      aria-valuemin={low}
      aria-valuemax={high}
      aria-valuenow={now}
      aria-valuetext={text}
      style={[vertical ? styles.thumbUp : styles.thumbAcross, kind === 'bold' && styles.thumbBold, kind === 'field' && styles.thumbField, place]}
      onAccessibilityAction={(e: AccessibilityActionEvent) => onStep(index, e.nativeEvent.actionName === 'increment')}
    >
      {kind === 'field' ? <View style={styles.mark} /> : (
        <>
          <Animated.View style={[styles.halo, halo]} />
          <Animated.View style={[styles.knob, kind === 'bold' && styles.knobBold, hold]} />
        </>
      )}
      {tip ? (
        <Animated.View {...(still ? {} : { entering: FadeInDown.duration(TIP_MS).easing(OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 4 }] }), exiting: FadeOut.duration(TIP_MS) })} style={[styles.tip, kind === 'bold' && styles.tipBold]}>
          <Text style={styles.tipText}>{text}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

/** Pick a value or a range by dragging. Thumbs follow the finger one to one and spring only when they jump. */
export function Slider({ value, defaultValue, onValueChange, min = 0, max = 100, step = 1, styleKind = 'line', label, format = String, orientation = 'horizontal', length = 160, alwaysTip = false, ticks = false, disabled = false, animated = true, style }: SliderProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const vertical = orientation === 'vertical'
  const look = LOOK[styleKind]
  const range = Array.isArray(value ?? defaultValue)
  const start = value ?? defaultValue ?? min
  const [held, setHeld] = useState<number[]>(Array.isArray(start) ? start : [start])
  const current = value === undefined ? held : Array.isArray(value) ? value : [value]
  const share = (v: number): number => (v - min) / (max - min)
  const first = useSharedValue(share(current[0] ?? min))
  const second = useSharedValue(share(current[1] ?? max))
  const live = useSharedValue<number[]>(current)
  const size = useSharedValue(0)
  const active = useSharedValue(-1)
  const grab = useSharedValue(0)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [tipFor, setTipFor] = useState<number | null>(null)
  const [entry, setEntry] = useState<{ index: number; text: string } | null>(null)
  const [trackLength, setTrackLength] = useState(0)
  const hide = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { pad } = look

  useEffect(() => () => clearTimeout(hide.current), [])

  useEffect(() => {
    if (value === undefined || activeIndex !== null) return
    const list = Array.isArray(value) ? value : [value]
    live.value = list
    first.value = ((list[0] ?? min) - min) / (max - min)
    if (list[1] !== undefined) second.value = (list[1] - min) / (max - min)
  }, [value, activeIndex, min, max, live, first, second])

  function commit(next: number[]): void {
    setHeld(next)
    onValueChange?.(range ? [next[0] ?? min, next[1] ?? max] : (next[0] ?? min))
  }

  function begin(index: number): void {
    clearTimeout(hide.current)
    setActiveIndex(index)
    setTipFor(index)
  }

  function finish(): void {
    setActiveIndex(null)
    hide.current = setTimeout(() => setTipFor(null), TIP_HIDE_MS)
  }

  /** Moves a thumb from the JS side, for typing and assistive actions. */
  function setAt(index: number, next: number): void {
    const list = [...current]
    list[index] = next
    commit(list)
    live.value = list
    const at = index === 0 ? first : second
    at.value = still ? share(next) : withSpring(share(next), JUMP)
  }

  const bounds = (index: number): [number, number] => [index === 1 ? (current[0] ?? min) : min, index === 0 && range ? (current[1] ?? max) : max]
  const snapJS = (raw: number): number => clamp(min + Math.round((raw - min) / step) * step, min, max)

  function stepBy(index: number, up: boolean): void {
    const [low, high] = bounds(index)
    setAt(index, clamp(snapJS((current[index] ?? min) + (up ? step : -step)), low, high))
  }

  function closeEntry(): void {
    if (!entry) return
    const typed = Number.parseFloat(entry.text.replace(/[^\d.-]/g, ''))
    if (Number.isFinite(typed)) {
      const [low, high] = bounds(entry.index)
      setAt(entry.index, clamp(snapJS(typed), low, high))
    }
    setEntry(null)
  }

  const toValue = (position: number): number => {
    'worklet'
    return min + ((position - pad) / Math.max(1, size.value - pad * 2)) * (max - min)
  }
  const snap = (raw: number): number => {
    'worklet'
    return clamp(min + Math.round((raw - min) / step) * step, min, max)
  }
  const along = (x: number, y: number): number => {
    'worklet'
    return vertical ? size.value - y : x
  }
  const nearest = (raw: number): number => {
    'worklet'
    if (!range) return 0
    const low = live.value[0] ?? min
    const high = live.value[1] ?? max
    // Thumbs on the same value: take the one that can still move toward the finger.
    if (low === high) return low <= min || (low < max && raw > low) ? 1 : 0
    return Math.abs(raw - high) < Math.abs(raw - low) ? 1 : 0
  }
  const move = (index: number, next: number, jump: boolean): void => {
    'worklet'
    const list = [...live.value]
    const changed = list[index] !== next
    list[index] = next
    live.value = list
    const at = index === 0 ? first : second
    const fraction = (next - min) / (max - min)
    at.value = jump && !still ? withSpring(fraction, JUMP) : fraction
    if (changed) runOnJS(commit)(list)
  }
  const limited = (index: number, next: number): number => {
    'worklet'
    const low = index === 1 ? (live.value[0] ?? min) : min
    const high = index === 0 && range ? (live.value[1] ?? max) : max
    return clamp(next, low, high)
  }

  const axis = vertical
    ? Gesture.Pan().activeOffsetY([-4, 4]).failOffsetX([-16, 16])
    : Gesture.Pan().activeOffsetX([-4, 4]).failOffsetY([-16, 16])
  const pan = axis
    .enabled(!disabled)
    .onStart((e) => {
      const raw = toValue(along(e.x, e.y))
      const index = nearest(raw)
      const distance = Math.abs(along(e.x, e.y) - (pad + (index === 0 ? first.value : second.value) * (size.value - pad * 2)))
      grab.value = distance <= GRAB_RADIUS ? raw - (live.value[index] ?? min) : 0
      active.value = index
      runOnJS(begin)(index)
      if (distance > GRAB_RADIUS) move(index, limited(index, snap(raw)), true)
    })
    .onUpdate((e) => {
      const index = active.value
      if (index < 0) return
      move(index, limited(index, snap(toValue(along(e.x, e.y)) - grab.value)), false)
    })
    .onFinalize(() => {
      if (active.value < 0) return
      active.value = -1
      runOnJS(finish)()
    })

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd((e) => {
      const raw = toValue(along(e.x, e.y))
      const index = nearest(raw)
      runOnJS(begin)(index)
      move(index, limited(index, snap(raw)), true)
      runOnJS(finish)()
    })

  const fill = useAnimatedStyle(() => {
    const room = Math.max(0, size.value - pad * 2)
    const from = range ? pad + first.value * room : 0
    const to = pad + (range ? second.value : first.value) * room
    const cap = styleKind === 'bold' ? pad : 0
    const lead = Math.max(0, from - (range ? cap : 0))
    const span = Math.max(0, to + cap - lead)
    return vertical ? { bottom: lead, height: span } : { left: lead, width: span }
  })

  function onLayout(e: LayoutChangeEvent): void {
    const measured = vertical ? e.nativeEvent.layout.height : e.nativeEvent.layout.width
    size.value = measured
    setTrackLength(measured)
  }

  const tick = styleKind === 'bold' && ticks && !vertical
    ? Array.from({ length: Math.max(0, Math.floor((trackLength - pad * 2) / TICK_EVERY) + 1) }, (_, i) => i)
    : []

  return (
    <View style={[vertical ? styles.upright : styles.slider, vertical && { height: length }, disabled && styles.disabled, style]}>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View collapsable={false} style={vertical ? styles.hitUp : styles.hit} onLayout={onLayout}>
          <View style={[vertical ? styles.railUp : styles.rail, styleKind === 'bold' && (vertical ? styles.railUpBold : styles.railBold), styleKind === 'field' && styles.railField]}>
            {tick.map((i) => <View key={i} style={[styles.tick, { left: pad + i * TICK_EVERY }]} />)}
            <Animated.View style={[vertical ? styles.fillUp : styles.fill, styleKind === 'field' && (activeIndex === null ? styles.fillField : styles.fillFieldActive), fill]} />
          </View>
          {current.map((v, i) => {
            const [low, high] = bounds(i)
            return (
              <Thumb
                key={i}
                index={i}
                at={i === 0 ? first : second}
                size={size}
                active={active}
                pad={pad}
                thumb={look.thumb}
                kind={styleKind}
                vertical={vertical}
                label={current.length > 1 ? `${label} ${i === 0 ? 'minimum' : 'maximum'}` : label}
                text={format(v)}
                low={low}
                high={high}
                now={v}
                tip={styleKind !== 'field' && !vertical && (alwaysTip || (tipFor === i && !still))}
                still={still}
                disabled={disabled}
                onStep={stepBy}
              />
            )
          })}
        </View>
      </GestureDetector>
      {styleKind === 'field' ? (
        <View pointerEvents="box-none" style={styles.fieldText}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <View pointerEvents="box-none" style={styles.fieldValue}>
            {current.map((v, i) => (
              <View key={i} pointerEvents="box-none" style={styles.fieldPart}>
                {i > 0 ? <Text style={styles.fieldNumber}>to</Text> : null}
                {entry?.index === i ? (
                  <TextInput
                    autoFocus
                    accessibilityLabel={range ? `${label} ${i === 0 ? 'minimum' : 'maximum'}` : label}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    selectTextOnFocus
                    style={styles.fieldEntry}
                    value={entry.text}
                    onBlur={closeEntry}
                    onChangeText={(text) => setEntry({ index: i, text })}
                    onSubmitEditing={closeEntry}
                  />
                ) : (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Type ${label}`} disabled={disabled} hitSlop={12} onPress={() => setEntry({ index: i, text: String(v) })}>
                    <Text style={styles.fieldNumber}>{format(v)}</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  slider: { justifyContent: 'center', minHeight: 44, width: '100%' },
  upright: { width: 44 },
  disabled: { opacity: 0.4 },
  hit: { height: 44, justifyContent: 'center' },
  hitUp: { alignItems: 'center', flex: 1 },
  rail: { backgroundColor: c.ink8, borderRadius: radius.full, height: 6, overflow: 'hidden' },
  railUp: { backgroundColor: c.ink8, borderRadius: radius.full, flex: 1, overflow: 'hidden', width: 6 },
  railBold: { backgroundColor: c.ink5, height: 32 },
  railUpBold: { backgroundColor: c.ink5, width: 32 },
  railField: { backgroundColor: c.ink4, borderRadius: radius.xl, height: 44 },
  fill: { backgroundColor: c.textPrimary, borderRadius: radius.full, bottom: 0, position: 'absolute', top: 0 },
  fillUp: { backgroundColor: c.textPrimary, borderRadius: radius.full, left: 0, position: 'absolute', right: 0 },
  fillField: { backgroundColor: c.ink8, borderRadius: 0 },
  fillFieldActive: { backgroundColor: c.ink10, borderRadius: 0 },
  thumbAcross: { alignItems: 'center', height: 18, justifyContent: 'center', left: 0, position: 'absolute', width: 18 },
  thumbUp: { alignItems: 'center', bottom: 0, height: 18, justifyContent: 'center', position: 'absolute', width: 18 },
  thumbBold: { height: 22, width: 22 },
  thumbField: { height: 16, width: 2 },
  mark: { backgroundColor: c.textPrimary, borderRadius: radius.xs, height: 16, width: 2 },
  knob: { ...StyleSheet.absoluteFill, backgroundColor: c.surface, borderColor: c.ink10, borderRadius: radius.full, borderWidth: 1 },
  knobBold: { borderColor: c.textPrimary, borderWidth: 3.5 },
  halo: { backgroundColor: c.ink8, borderRadius: radius.full, bottom: -8, left: -8, position: 'absolute', right: -8, top: -8 },
  tip: { backgroundColor: c.inverse, borderRadius: radius.lg, bottom: 24, paddingHorizontal: space[2], paddingVertical: space[1], position: 'absolute' },
  tipBold: { bottom: 32 },
  tipText: type(12, c.textInverse, '500'),
  tick: { backgroundColor: c.ink10, bottom: 12, position: 'absolute', top: 12, width: 1 },
  fieldText: { ...StyleSheet.absoluteFill, alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingHorizontal: space[3] },
  fieldLabel: type(14, c.textPrimary, '500'),
  fieldValue: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  fieldPart: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  fieldNumber: type(12, c.textSecondary, '400', true),
  fieldEntry: { backgroundColor: c.surface, borderColor: c.ink10, borderRadius: radius.md, borderWidth: 1, color: c.textPrimary, fontFamily: font.mono, fontSize: 12, minWidth: 44, paddingHorizontal: space[1], paddingVertical: space[0.5] },
})
