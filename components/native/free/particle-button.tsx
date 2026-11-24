import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { HEIGHT, ICON_SIZE, LabelSwap, PressScale, withInk, type PressScaleProps } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { Spinner } from './spinner'

const SHAKE = [-5, 5, -3, 3, 0]
const SHAKE_STEP_MS = 72
const CHIPS = Array.from({ length: 12 }, (_, index) => index)
const FLIGHT_MS = 650
const HOLD_MS = 1600

export type ParticleButtonProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  variant?: 'primary' | 'outline'
  label?: string
  pendingLabel?: string
  successLabel?: string
  errorLabel?: string
  /** Runs on press. Resolve for Success, reject for Error. */
  onAction?: () => Promise<void> | void
  /** Draws `tick-02` and `alert-circle`. */
  renderIcon: RenderIcon
  /** `false` turns off the chips, the shake and the press scale. */
  animated?: boolean
}

type State = 'idle' | 'pending' | 'success' | 'error'

/** Each chip flies out with gravity and spin. Seeded by index, so a burst always looks the same. */
function Chip({ index, flight }: { index: number; flight: SharedValue<number> }) {
  const styles = useThemed(createStyles)
  const angle = (index / CHIPS.length) * Math.PI * 2
  const reach = 34 + (index % 3) * 12
  const x = Math.cos(angle) * reach * 1.5
  const y = Math.sin(angle) * reach
  const turn = index % 2 ? 180 : -180
  const chipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(flight.value, [0, 0.6, 1], [1, 1, 0]),
    transform: [
      { translateX: flight.value * x },
      { translateY: interpolate(flight.value, [0, 0.6, 1], [0, y, y + 28]) },
      { rotate: `${flight.value * turn}deg` },
    ],
  }))
  return <Animated.View style={[styles.chip, index % 2 ? styles.dot : styles.chipBar, chipStyle]} />
}

function Burst() {
  const styles = useThemed(createStyles)
  const flight = useSharedValue(0)
  useEffect(() => {
    flight.value = withTiming(1, { duration: FLIGHT_MS, easing: Easing.bezier(0, 0, 0.58, 1) })
  }, [flight])
  return <View pointerEvents="none" style={styles.burst}>{CHIPS.map((index) => <Chip key={index} index={index} flight={flight} />)}</View>
}

/** An async button that walks Idle, Pending, Success and Error. */
export function ParticleButton({ variant = 'primary', label = 'Save changes', pendingLabel = 'Saving', successLabel = 'Saved', errorLabel = 'Try again', onAction, onPress, renderIcon, animated = true, disabled, style, onLayout, ...rest }: ParticleButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [state, setState] = useState<State>('idle')
  const shake = useSharedValue(0)
  const lock = useSharedValue(0)
  const restWidth = useRef(0)
  const shakeStyle = useAnimatedStyle(() => ({ minWidth: lock.value, transform: [{ translateX: shake.value }] }))
  const off = Boolean(disabled)
  const settled = state === 'success' || state === 'error'
  const solidInk = settled || (variant === 'primary' && !off)

  useEffect(() => { lock.value = state === 'idle' ? 0 : restWidth.current }, [state, lock])

  useEffect(() => {
    if (!settled) return undefined
    if (state === 'error' && !still) shake.value = withSequence(...SHAKE.map((to) => withTiming(to, { duration: SHAKE_STEP_MS })))
    const timer = setTimeout(() => setState('idle'), HOLD_MS)
    return () => clearTimeout(timer)
  }, [state, settled, still, shake])

  async function handlePress(event: GestureResponderEvent): Promise<void> {
    onPress?.(event)
    if (state !== 'idle') return
    setState('pending')
    try {
      await onAction?.()
      setState('success')
    } catch {
      setState('error')
    }
  }

  function handleLayout(event: LayoutChangeEvent): void {
    if (state === 'idle') restWidth.current = event.nativeEvent.layout.width
    onLayout?.(event)
  }

  const ink = off ? colors.textQuaternary : solidInk ? colors.textInverse : colors.textPrimary
  const face = {
    idle: { text: label, icon: null },
    pending: { text: pendingLabel, icon: <Spinner size={ICON_SIZE} color={ink} label={null} animated={animated} /> },
    success: { text: successLabel, icon: withInk(renderIcon('tick-02', ICON_SIZE), ink) },
    error: { text: errorLabel, icon: withInk(renderIcon('alert-circle', ICON_SIZE), ink) },
  }[state]

  return (
    <Animated.View style={[styles.box, shakeStyle, style]}>
      <PressScale
        accessibilityRole="button"
        accessibilityLabel={face.text}
        accessibilityLiveRegion="polite"
        aria-busy={state === 'pending'}
        aria-disabled={off || state !== 'idle'}
        still={still || state !== 'idle'}
        disabled={disabled}
        contentStyle={[styles.button, variant === 'primary' ? styles.primary : styles.outline, off && styles.buttonOff, state === 'success' && styles.success, state === 'error' && styles.error]}
        pressedStyle={state === 'idle' && (variant === 'primary' ? styles.primaryPressed : styles.outlinePressed)}
        onPress={(event) => void handlePress(event)}
        onLayout={handleLayout}
        {...rest}
      >
        <LabelSwap swapKey={state} still={still} style={styles.face}>
          {face.icon}
          <Text numberOfLines={1} style={[styles.label, solidInk && styles.labelSolid, off && styles.labelOff]}>{face.text}</Text>
        </LabelSwap>
        {state === 'success' && !still ? <Burst /> : null}
      </PressScale>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  button: { alignItems: 'center', borderRadius: radius.xl, height: HEIGHT.md, justifyContent: 'center', paddingHorizontal: space[3.5] },
  primary: { backgroundColor: c.inverse },
  primaryPressed: { opacity: 0.8 },
  outline: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1 },
  outlinePressed: { backgroundColor: c.ink5 },
  buttonOff: { backgroundColor: c.ink5, borderColor: 'transparent' },
  success: { backgroundColor: c.success, borderColor: 'transparent' },
  error: { backgroundColor: c.danger, borderColor: 'transparent' },
  face: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
  label: type(16, c.textPrimary, '500'),
  labelSolid: { color: c.textInverse },
  labelOff: { color: c.textQuaternary },
  burst: { left: '50%', position: 'absolute', top: '50%' },
  chip: { backgroundColor: c.success, borderRadius: radius.full, position: 'absolute' },
  chipBar: { height: 2, width: 6 },
  dot: { height: 4, width: 4 },
})
