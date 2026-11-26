import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { interpolateColor, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { radius, useColors, type Colors } from '../kit'
import { EASE_OUT_SOFT, ICON_SIZE, withInk, type Spring } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { Spinner } from './spinner'

const INSET = 4
const THUMB = 48
const TRACK = 56
const COMMIT_AT = 0.9
const FLICK = 800
const NUDGE = 0.1
const DONE_MS = 260
const SNAP: Spring = { stiffness: 520, damping: 42, mass: 1 }
const ACTIONS = [{ name: 'activate' }, { name: 'increment' }, { name: 'decrement' }]

export type SlideToConfirmProps = {
  label?: string
  doneLabel?: string
  /** Runs at the end of the slide. The thumb shows a loader until the promise settles. */
  onConfirm?: () => Promise<void> | void
  /** Draws `arrow-right` and `tick-02`. */
  renderIcon: RenderIcon
  disabled?: boolean
  /** `false` jumps the thumb instead of springing it. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type State = 'idle' | 'dragging' | 'confirming' | 'done'

/** Drag the thumb across to confirm. Past 90% or a fast flick, it commits. */
export function SlideToConfirm({ label = 'Slide to pay $24.00', doneLabel = 'Paid', onConfirm, renderIcon, disabled, animated = true, style }: SlideToConfirmProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [state, setState] = useState<State>('idle')
  const [percent, setPercent] = useState(0)
  const x = useSharedValue(0)
  const start = useSharedValue(0)
  const width = useSharedValue(0)
  const done = useSharedValue(0)
  const locked = Boolean(disabled) || state === 'confirming' || state === 'done'

  useEffect(() => {
    done.value = withTiming(state === 'done' ? 1 : 0, { duration: DONE_MS, easing: EASE_OUT_SOFT })
  }, [state, done])

  const moveTo = useCallback((to: number) => {
    x.value = still ? to : withSpring(to, SNAP)
  }, [still, x])

  const commit = useRef<() => Promise<void>>(async () => undefined)
  commit.current = async () => {
    setState('confirming')
    moveTo(width.value - THUMB - INSET * 2)
    try {
      await onConfirm?.()
      setState('done')
    } catch {
      setState('idle')
      moveTo(0)
    }
  }
  const fire = useCallback(() => { void commit.current() }, [])

  useAnimatedReaction(
    () => {
      const travel = width.value - THUMB - INSET * 2
      return travel > 0 ? Math.round((x.value / travel) * 10) * 10 : 0
    },
    (next, previous) => { if (next !== previous) runOnJS(setPercent)(next) },
  )

  const pan = useMemo(() => Gesture.Pan()
    .enabled(!locked)
    .activeOffsetX([-6, 6])
    .failOffsetY([-16, 16])
    .onStart(() => {
      start.value = x.value
      runOnJS(setState)('dragging')
    })
    .onUpdate((event) => {
      x.value = Math.min(width.value - THUMB - INSET * 2, Math.max(0, start.value + event.translationX))
    })
    .onEnd((event) => {
      const travel = width.value - THUMB - INSET * 2
      if (x.value / travel >= COMMIT_AT || event.velocityX > FLICK) {
        runOnJS(fire)()
        return
      }
      runOnJS(setState)('idle')
      x.value = still ? 0 : withSpring(0, SNAP)
    }), [locked, still, fire, start, width, x])

  /** Stands in for the arrow keys and Enter: a screen reader cannot drag. */
  function handleAction({ nativeEvent }: AccessibilityActionEvent): void {
    if (locked) return
    if (nativeEvent.actionName === 'activate') { fire(); return }
    const travel = width.value - THUMB - INSET * 2
    const next = Math.min(1, Math.max(0, x.value / travel + (nativeEvent.actionName === 'increment' ? NUDGE : -NUDGE)))
    x.value = next * travel
    if (next >= COMMIT_AT) fire()
  }

  const trailStyle = useAnimatedStyle(() => {
    const travel = width.value - THUMB - INSET * 2
    const reached = travel > 0 ? Math.min(1, x.value / travel) : 0
    return {
      // Follows the thumb, then closes the last inset as it arrives, so a full track has no gap.
      backgroundColor: interpolateColor(done.value, [0, 1], [colors.inverse, colors.success]),
      width: x.value > 0 ? x.value + THUMB + INSET + INSET * reached : 0,
    }
  })
  const trailLabelStyle = useAnimatedStyle(() => ({ width: width.value }))
  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const text = state === 'done' ? doneLabel : label

  return (
    <View style={[styles.track, disabled && styles.off, style]} onLayout={(event) => { width.value = event.nativeEvent.layout.width }}>
      <View pointerEvents="none" style={styles.ring} />
      <View style={styles.center}><Text numberOfLines={1} style={styles.label}>{text}</Text></View>
      <Animated.View style={[styles.trail, trailStyle]}>
        <Animated.View style={[styles.trailCenter, trailLabelStyle]}><Text numberOfLines={1} style={styles.trailLabel}>{text}</Text></Animated.View>
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          aria-disabled={Boolean(disabled)}
          aria-busy={state === 'confirming'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={state === 'done' ? doneLabel : `${percent}%`}
          accessibilityActions={ACTIONS}
          onAccessibilityAction={handleAction}
          style={[styles.thumb, thumbStyle]}
        >
          {state === 'confirming'
            ? <Spinner size={ICON_SIZE} color={colors.textPrimary} label={null} animated={animated} />
            : withInk(renderIcon(state === 'done' ? 'tick-02' : 'arrow-right', ICON_SIZE), colors.textPrimary)}
        </Animated.View>
      </GestureDetector>
      <Text accessibilityLiveRegion="polite" style={styles.live}>{state === 'done' ? doneLabel : ''}</Text>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  // Fills its column like the web track does at 390.
  track: { backgroundColor: c.ink5, borderRadius: radius.full, height: TRACK, overflow: 'hidden', width: '100%' },
  ring: { ...StyleSheet.absoluteFill, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1 },
  off: { opacity: 0.4 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  label: type(16, c.textTertiary, '500'),
  trail: { borderRadius: radius.full, bottom: 0, left: 0, overflow: 'hidden', position: 'absolute', top: 0 },
  trailCenter: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', top: 0 },
  trailLabel: type(16, c.textInverse, '500'),
  thumb: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, height: THUMB, justifyContent: 'center', left: INSET, position: 'absolute', top: INSET, width: THUMB, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8 },
  live: { height: 1, opacity: 0, position: 'absolute', width: 1 },
})
