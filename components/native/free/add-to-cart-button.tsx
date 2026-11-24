import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeOut, FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { RollingText } from './badge'
import { EASE_OUT, HEIGHT, LabelSwap, PressScale, TARGET, withInk } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

const REPEAT_AFTER = 380
const REPEAT_SLOW = 150
const REPEAT_FAST = 55
const REPEAT_STEP = 0.8
const WIDTH_MS = 320
const TIP_MS = 1600
const TIP_FADE_MS = 120
const STEP_ICON = 14
const ADD_WIDTH = 80
const OPEN_WIDTH = 108
const TIP_IN = FadeInDown.duration(TIP_FADE_MS).withInitialValues({ transform: [{ translateY: 4 }] })

export type AddToCartButtonProps = {
  label?: string
  /** Controlled quantity. 0 shows Add. */
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  /** Default 9. */
  max?: number
  /** Draws `plus`, `minus` and `trash`. */
  renderIcon: RenderIcon
  disabled?: boolean
  /** `false` turns off the width ease, the rolling count and the press scale. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Step({ label, icon, off, onStep, onBlocked, still }: { label: string; icon: ReactNode; off: boolean; onStep: () => void; onBlocked: () => void; still: boolean }) {
  const styles = useThemed(createStyles)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const repeated = useRef(false)
  const step = useRef(onStep)
  step.current = onStep
  const stop = (): void => clearTimeout(timer.current)

  useEffect(() => stop, [])
  useEffect(() => { if (off) stop() }, [off])

  // Holding repeats, speeding up from 150 ms to 55 ms.
  function start(): void {
    repeated.current = false
    if (off) return
    let wait = REPEAT_SLOW
    const run = (): void => {
      repeated.current = true
      step.current()
      wait = Math.max(REPEAT_FAST, wait * REPEAT_STEP)
      timer.current = setTimeout(run, wait)
    }
    timer.current = setTimeout(run, REPEAT_AFTER)
  }

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={off}
      still={still || off}
      scale={0.94}
      hitSlop={(TARGET - HEIGHT.sm) / 2}
      contentStyle={[styles.step, off && styles.stepOff]}
      pressedStyle={!off && styles.stepPressed}
      onPress={() => {
        if (off) onBlocked()
        else if (!repeated.current) onStep()
      }}
      onPressIn={start}
      onPressOut={stop}
    >
      {icon}
    </PressScale>
  )
}

/** Add opens into a quantity stepper in place. */
export function AddToCartButton({ label = 'Add', value, defaultValue = 0, onValueChange, max = 9, renderIcon, disabled, animated = true, style }: AddToCartButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const [tip, setTip] = useState(false)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const count = value ?? held
  const open = count > 0
  const atLimit = count >= max
  const off = Boolean(disabled)
  const latest = useRef(count)
  latest.current = count
  // Add is 80 wide, or wider when a longer label needs the room.
  const [addWidth, setAddWidth] = useState(ADD_WIDTH)
  const width = useSharedValue(open ? OPEN_WIDTH : ADD_WIDTH)
  const widthStyle = useAnimatedStyle(() => ({ width: width.value }))

  useEffect(() => {
    const target = open ? OPEN_WIDTH : addWidth
    width.value = still ? target : withTiming(target, { duration: WIDTH_MS, easing: EASE_OUT })
  }, [open, still, width, addWidth])

  useEffect(() => () => clearTimeout(tipTimer.current), [])

  function set(next: number): void {
    const clamped = Math.min(max, Math.max(0, next))
    latest.current = clamped
    setHeld(clamped)
    onValueChange?.(clamped)
  }

  /** Web shows this on hover. Touch shows it when a press hits the limit. */
  function showTip(): void {
    setTip(true)
    clearTimeout(tipTimer.current)
    tipTimer.current = setTimeout(() => setTip(false), TIP_MS)
  }

  return (
    <Animated.View role={open ? 'group' : undefined} accessibilityLabel={open ? 'Quantity' : undefined} style={[styles.root, widthStyle, style]}>
      <View
        aria-hidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={styles.measure}
      >
        <View style={styles.measureRow} onLayout={(e) => setAddWidth(Math.max(ADD_WIDTH, Math.ceil(e.nativeEvent.layout.width)))}>
          <View style={styles.icon} />
          <Text numberOfLines={1} style={styles.addText}>{label}</Text>
        </View>
      </View>
      {open && tip && atLimit ? (
        <Animated.View accessibilityLiveRegion="polite" {...(still ? {} : { entering: TIP_IN, exiting: FadeOut.duration(TIP_FADE_MS) })} style={styles.tip}>
          <Text numberOfLines={1} style={styles.tipText}>Limit {max} per order</Text>
        </Animated.View>
      ) : null}
      {open ? (
        <View style={[styles.stepper, off && styles.off]}>
          <Step
            label={count === 1 ? 'Remove' : 'Decrease quantity'}
            icon={<LabelSwap swapKey={count === 1 ? 'bin' : 'minus'} still={still}>{withInk(renderIcon(count === 1 ? 'trash' : 'minus', STEP_ICON), colors.textInverse)}</LabelSwap>}
            off={off}
            still={still}
            onStep={() => set(latest.current - 1)}
            onBlocked={() => undefined}
          />
          <View accessibilityLiveRegion="polite"><RollingText value={String(count)} still={still} style={styles.count} /></View>
          <Step
            label="Increase quantity"
            icon={withInk(renderIcon('plus', STEP_ICON), colors.textInverse)}
            off={off || atLimit}
            still={still}
            onStep={() => set(latest.current + 1)}
            onBlocked={() => { if (!off) showTip() }}
          />
        </View>
      ) : (
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={label}
          aria-disabled={off}
          still={still}
          disabled={disabled}
          style={styles.fill}
          contentStyle={[styles.add, off && styles.addOff]}
          pressedStyle={styles.addPressed}
          onPress={() => set(1)}
        >
          {withInk(renderIcon('plus', STEP_ICON), off ? colors.textQuaternary : colors.textPrimary)}
          <Text numberOfLines={1} style={[styles.addText, off && styles.addTextOff]}>{label}</Text>
        </PressScale>
      )}
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  root: { height: HEIGHT.md },
  fill: { flex: 1 },
  // Wide enough that the label row inside takes its natural width.
  measure: { alignItems: 'flex-start', left: 0, opacity: 0, position: 'absolute', top: 0, width: 600 },
  measureRow: { flexDirection: 'row', gap: space[1.5], paddingHorizontal: space[3] },
  icon: { width: STEP_ICON },
  add: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, flex: 1, flexDirection: 'row', gap: space[1.5], justifyContent: 'center' },
  addOff: { backgroundColor: c.ink5, borderColor: 'transparent' },
  addPressed: { backgroundColor: c.ink5 },
  addText: type(16, c.textPrimary, '500'),
  addTextOff: { color: c.textQuaternary },
  stepper: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.full, flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[1] },
  off: { opacity: 0.4 },
  step: { alignItems: 'center', borderRadius: radius.full, height: HEIGHT.sm, justifyContent: 'center', width: HEIGHT.sm },
  stepOff: { opacity: 0.4 },
  stepPressed: { backgroundColor: c.ink10 },
  count: type(16, c.textInverse, '500'),
  tip: { alignSelf: 'center', backgroundColor: c.inverse, borderRadius: radius.lg, bottom: HEIGHT.md + space[1.5], paddingHorizontal: space[2], paddingVertical: space[1], position: 'absolute' },
  tipText: type(12, c.textInverse, '500'),
})
