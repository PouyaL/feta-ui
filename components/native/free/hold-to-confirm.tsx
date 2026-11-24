import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { LabelSwap, withInk } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

// Press and hold to confirm. A sweep crosses the button from the leading edge; it fires when it meets
// the far edge, and springs back if you let go early. Mirrors the web component.

export type HoldToConfirmProps = {
  kind?: 'outline' | 'solid'
  label?: string
  progressLabel?: string
  doneLabel?: string
  icon?: ReactNode
  /** Draws `tick-02`, and `delete-02` when `icon` is left out. */
  renderIcon: RenderIcon
  /** Fires when the sweep reaches the far edge. */
  onComplete?: () => void
  disabled?: boolean
  /** `false` keeps the sweep, which shows progress, but drops the press, the pop and the label motion. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Phase = 'rest' | 'holding' | 'complete'

const HOLD_MS = 1600
const RESET_MS = 1600
const SWEEP_CURVE = 1.6
const HOLD_SCALE = 0.97
const PRESS_SPRING = { stiffness: 600, damping: 32, mass: 1 }
const POP_SPRING = { stiffness: 500, damping: 22, mass: 1 }
const SETTLE_SPRING = { stiffness: 420, damping: 42, mass: 1 }
const PROGRESS_STEP = 10
/** The outline sweep: the danger red at 12%, which reads in Light and Dark. Kit has no subtle danger yet. */
const DANGER_TINT = 'rgba(239,68,68,0.12)'

export function HoldToConfirm({ kind = 'outline', label = 'Hold to delete', progressLabel = 'Release to cancel', doneLabel = 'Deleted', icon, renderIcon, onComplete, disabled, animated = true, style }: HoldToConfirmProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const solid = kind === 'solid'
  const [phase, setPhaseState] = useState<Phase>('rest')
  const phaseRef = useRef<Phase>('rest')
  const setPhase = (next: Phase) => { phaseRef.current = next; setPhaseState(next) }
  const [step, setStep] = useState(0)
  const time = useSharedValue(0)
  const scale = useSharedValue(1)
  const width = useSharedValue(0)
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null)
  const done = useRef(onComplete)
  done.current = onComplete

  useEffect(() => () => { if (reset.current) clearTimeout(reset.current) }, [])

  useAnimatedReaction(() => Math.round((Math.pow(Math.min(1, time.value), SWEEP_CURVE) * 100) / PROGRESS_STEP) * PROGRESS_STEP, (next, last) => { if (next !== last) runOnJS(setStep)(next) })

  const finish = () => {
    if (phaseRef.current !== 'holding') return
    setPhase('complete')
    if (!still) scale.value = withSpring(1, POP_SPRING)
    done.current?.()
    reset.current = setTimeout(() => {
      setPhase('rest')
      time.value = still ? 0 : withSpring(0, SETTLE_SPRING)
    }, RESET_MS)
  }

  const start = () => {
    if (disabled || phaseRef.current !== 'rest') return
    setPhase('holding')
    if (!still) scale.value = withSpring(HOLD_SCALE, PRESS_SPRING)
    cancelAnimation(time)
    time.value = withTiming(1, { duration: HOLD_MS * (1 - time.value), easing: Easing.linear }, (finished) => { if (finished) runOnJS(finish)() })
  }

  const stop = () => {
    if (phaseRef.current !== 'holding') return
    cancelAnimation(time)
    setPhase('rest')
    if (!still) scale.value = withSpring(1, PRESS_SPRING)
    time.value = still ? 0 : withSpring(0, SETTLE_SPRING)
  }

  const sweep = useAnimatedStyle(() => {
    const v = Math.pow(Math.min(1, Math.max(0, time.value)), SWEEP_CURVE)
    return { transform: [{ translateX: -width.value * (1 - v) }] }
  })
  const edge = useAnimatedStyle(() => {
    const v = Math.pow(Math.min(1, Math.max(0, time.value)), SWEEP_CURVE)
    return { opacity: v > 0.001 && v < 0.999 ? 1 : 0, transform: [{ translateX: v * width.value - 1 }] }
  })
  const pressed = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const ink = disabled ? styles.inkDisabled.color : phase === 'rest' ? (solid ? styles.inkSolid.color : styles.ink.color) : (solid ? styles.inkSolid.color : styles.inkDanger.color)
  const shown = phase === 'complete' ? doneLabel : phase === 'holding' ? progressLabel : label
  const glyph = phase === 'complete' ? renderIcon('tick-02', 18) : (icon ?? renderIcon('delete-02', 18))

  return (
    <Animated.View style={[solid ? styles.wrapSolid : styles.wrap, pressed, style]}>
      <Pressable
        onPressIn={start}
        onPressOut={stop}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Press and hold"
        aria-disabled={Boolean(disabled)}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={step}
        onLayout={(event: LayoutChangeEvent) => { width.value = event.nativeEvent.layout.width }}
        style={[styles.button, solid ? styles.solid : styles.outline, phase === 'complete' && (solid ? styles.solidDone : styles.outlineDone), disabled && styles.disabled]}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, solid ? styles.sweepSolid : styles.sweep, sweep]} />
        <Animated.View pointerEvents="none" style={[styles.edge, solid ? styles.edgeSolid : styles.edgeOutline, edge]} />
        <LabelSwap swapKey={phase} still={still} style={styles.content}>
          {withInk(glyph, ink)}
          <Text style={[styles.label, { color: ink }]} numberOfLines={1}>{shown}</Text>
        </LabelSwap>
      </Pressable>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  wrapSolid: { alignSelf: 'stretch', maxWidth: 288 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radius.full },
  outline: { height: 46, paddingHorizontal: space[4], backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.ink10 },
  solid: { height: 64, paddingHorizontal: space[6], backgroundColor: c.inverse },
  outlineDone: { backgroundColor: DANGER_TINT },
  solidDone: { backgroundColor: c.danger },
  disabled: { backgroundColor: c.ink5, borderColor: 'transparent' },
  sweep: { backgroundColor: DANGER_TINT },
  sweepSolid: { backgroundColor: c.danger },
  edge: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2 },
  edgeOutline: { backgroundColor: c.danger },
  edgeSolid: { backgroundColor: 'rgba(255,255,255,0.6)' },
  content: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  label: { ...type(14, c.textPrimary, '500') },
  ink: { color: c.textPrimary },
  inkSolid: { color: c.textInverse },
  inkDanger: { color: c.danger },
  inkDisabled: { color: c.textQuaternary },
})
