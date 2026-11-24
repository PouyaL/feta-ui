import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AccessibilityInfo, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { RollingText } from './badge'
import { EASE_OUT, HEIGHT, ICON_SIZE, LabelSwap, TARGET, usePressScale, withInk } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

const WIDTH_MS = 320
const DONE_MS = 2400
const UNDO_ICON = 14
const UNDO_HEIGHT = 32
const UNDO_SLOP = (TARGET - UNDO_HEIGHT) / 2
const RESIZE = LinearTransition.duration(WIDTH_MS).easing(EASE_OUT)

export type UndoButtonProps = {
  label?: string
  /** Shown once the action runs. */
  doneLabel?: string
  icon?: ReactNode
  /** Draws `undo` and `tick-02`. */
  renderIcon: RenderIcon
  /** Seconds to take it back. Default 5. */
  seconds?: number
  /** Fires when the window closes. Run the real action here. */
  onCommit?: () => void
  onUndo?: () => void
  disabled?: boolean
  /** `false` turns off the width ease and the rolling count. The bar still drains: it is information. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type State = 'idle' | 'pending' | 'done'

/** Counts down the window, even when still: it shows time passing. */
function DrainBar({ seconds }: { seconds: number }) {
  const styles = useThemed(createStyles)
  const left = useSharedValue(1)
  useEffect(() => {
    left.value = withTiming(0, { duration: seconds * 1000, easing: Easing.linear })
  }, [seconds, left])
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: left.value }] }))
  return <Animated.View style={[styles.bar, barStyle]} />
}

/** An action with a window to take it back. */
export function UndoButton({ label = 'Archive', doneLabel = 'Archived', icon, renderIcon, seconds = 5, onCommit, onUndo, disabled, animated = true, style }: UndoButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const pressing = usePressScale(still || Boolean(disabled))
  const [state, setState] = useState<State>('idle')
  const [left, setLeft] = useState(seconds)
  const commit = useRef(onCommit)
  commit.current = onCommit
  const off = Boolean(disabled)

  useEffect(() => {
    if (state !== 'pending') return undefined
    AccessibilityInfo.announceForAccessibility(`${doneLabel}. Undo available`)
    const end = Date.now() + seconds * 1000
    const tick = setInterval(() => setLeft(Math.max(1, Math.ceil((end - Date.now()) / 1000))), 100)
    const done = setTimeout(() => { setState('done'); commit.current?.() }, seconds * 1000)
    return () => { clearInterval(tick); clearTimeout(done) }
  }, [state, seconds, doneLabel])

  useEffect(() => {
    if (state !== 'done') return undefined
    const reset = setTimeout(() => setState('idle'), DONE_MS)
    return () => clearTimeout(reset)
  }, [state])

  function undo(): void {
    setState('idle')
    onUndo?.()
  }

  const shell = [styles.shell, state === 'idle' && styles.idle, state === 'idle' && off && styles.idleOff, state === 'pending' && styles.pending, state === 'done' && styles.done]

  return (
    <Animated.View style={[styles.box, pressing.style, style]}>
      <Animated.View {...(still ? {} : { layout: RESIZE })} style={shell}>
        {state === 'done' ? <View pointerEvents="none" style={styles.doneTint} /> : null}
        {state === 'idle' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            aria-disabled={off}
            disabled={off}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => { setLeft(seconds); setState('pending') }}
            onPressIn={pressing.pressIn}
            onPressOut={pressing.pressOut}
          >
            {withInk(icon, off ? colors.textQuaternary : colors.textPrimary)}
            <LabelSwap swapKey="idle" still={still}><Text numberOfLines={1} style={[styles.label, off && styles.labelOff]}>{label}</Text></LabelSwap>
          </Pressable>
        ) : null}
        {state === 'done' ? (
          <View accessibilityLiveRegion="polite" style={styles.row}>
            {withInk(renderIcon('tick-02', ICON_SIZE), colors.success)}
            <LabelSwap swapKey="done" still={still}><Text numberOfLines={1} style={styles.label}>{doneLabel}</Text></LabelSwap>
          </View>
        ) : null}
        {state === 'pending' ? (
          <View style={styles.pendingRow}>
            <LabelSwap swapKey="pending" still={still}><Text numberOfLines={1} style={styles.pendingLabel}>{doneLabel}</Text></LabelSwap>
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Undo, ${left} seconds left`}
              hitSlop={UNDO_SLOP}
              style={({ pressed }) => [styles.undo, pressed && styles.undoPressed]}
              onPress={undo}
            >
              {withInk(renderIcon('undo', UNDO_ICON), colors.textPrimary)}
              <Text style={styles.undoText}>Undo</Text>
              <RollingText value={String(left)} still={still} style={styles.seconds} />
            </Pressable>
          </View>
        ) : null}
        {state === 'pending' ? <DrainBar seconds={seconds} /> : null}
      </Animated.View>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  shell: { borderRadius: radius.full, height: HEIGHT.md, overflow: 'hidden' },
  idle: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1 },
  idleOff: { backgroundColor: c.ink5, borderColor: 'transparent' },
  pending: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1 },
  done: { backgroundColor: 'transparent' },
  doneTint: { ...StyleSheet.absoluteFill, backgroundColor: c.success, opacity: 0.12 },
  row: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[2], paddingHorizontal: space[3.5] },
  rowPressed: { backgroundColor: c.ink5 },
  label: type(16, c.textPrimary, '500'),
  labelOff: { color: c.textQuaternary },
  pendingRow: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[2.5], paddingLeft: space[3.5], paddingRight: space[1.5] },
  pendingLabel: type(16, c.textTertiary, '500'),
  divider: { backgroundColor: c.ink10, height: space[4], width: 1 },
  undo: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', gap: space[1.5], height: UNDO_HEIGHT, paddingHorizontal: space[2] },
  undoPressed: { backgroundColor: c.ink8 },
  undoText: type(14, c.textPrimary, '500'),
  seconds: { ...type(12, c.textTertiary, '400', true), minWidth: space[2] },
  bar: { backgroundColor: c.textPrimary, bottom: 0, height: 2, left: 0, position: 'absolute', right: 0, transformOrigin: 'left' },
})
