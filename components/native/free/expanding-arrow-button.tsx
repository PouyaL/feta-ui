import { useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, View, type GestureResponderEvent } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { EASE_OUT, PressScale, type PressScaleProps } from './button'
import { type, useStill, useThemed } from './card'

const CHIP_MS = 500
const FADE_MS = 200
const CHIP_EASE = Easing.bezier(0.2, 0.9, 0.25, 1)
const CHIP = 32
const INSET = space[1]
const TRAIL_STEP = 26
const SHADES = [1, 0.72, 0.5, 0.3, 0.14] as const
/** Dots per column of one chevron. */
const COLUMNS = [2, 2, 1] as const
/** Hits the 44 target from the 40 height. */
const SLOP = 2

export type ExpandingArrowButtonProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  kind?: 'primary' | 'secondary'
  children?: ReactNode
  /** `false` still opens the chip, without motion, and turns off the press scale. */
  animated?: boolean
}

function Chevron({ index, open, secondary, off }: { index: number; open: SharedValue<number>; secondary: boolean; off: boolean }) {
  const styles = useThemed(createStyles)
  const shade = SHADES[index] ?? 1
  const trailStyle = useAnimatedStyle(() => ({
    opacity: index === 0 ? 1 : shade * open.value,
    transform: [{ translateX: (1 - open.value) * (index * -TRAIL_STEP - 1) }],
  }))
  return (
    <Animated.View style={[styles.trail, trailStyle]}>
      {COLUMNS.map((dots, column) => (
        <View key={column} style={[styles.column, column === 0 && styles.tall, column === 1 && styles.short]}>
          {Array.from({ length: dots }, (_, dot) => <View key={dot} style={[styles.dot, !secondary && styles.dotPrimary, secondary && styles.dotSecondary, off && styles.dotOff]} />)}
        </View>
      ))}
    </Animated.View>
  )
}

/** A wide call to action. While pressed, hovered or focused, the chip opens across it as its chevrons run. */
export function ExpandingArrowButton({ kind = 'primary', children = 'Get started', animated = true, disabled, style, onPressIn, onPressOut, onHoverIn, onHoverOut, onFocus, onBlur, onLayout, accessibilityLabel, ...rest }: ExpandingArrowButtonProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const off = Boolean(disabled)
  const secondary = kind === 'secondary'
  const [pressing, setPressing] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const shown = !off && (pressing || hovering || focused)
  const open = useSharedValue(0)
  const label = useSharedValue(0)
  const inner = useSharedValue(0)

  useEffect(() => {
    open.value = still ? (shown ? 1 : 0) : withTiming(shown ? 1 : 0, { duration: CHIP_MS, easing: CHIP_EASE })
    label.value = still ? (shown ? 1 : 0) : withTiming(shown ? 1 : 0, { duration: FADE_MS, easing: EASE_OUT })
  }, [shown, still, open, label])

  const chipStyle = useAnimatedStyle(() => ({ width: CHIP + (Math.max(CHIP, inner.value) - CHIP) * open.value }))
  const labelStyle = useAnimatedStyle(() => ({ opacity: 1 - label.value }))

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
      aria-disabled={off}
      still={still}
      disabled={disabled}
      hitSlop={SLOP}
      style={[styles.box, style]}
      contentStyle={[styles.button, secondary ? styles.secondary : styles.primary, off && styles.buttonOff]}
      pressedStyle={secondary && styles.secondaryPressed}
      onPressIn={(event: GestureResponderEvent) => { setPressing(true); onPressIn?.(event) }}
      onPressOut={(event: GestureResponderEvent) => { setPressing(false); onPressOut?.(event) }}
      onHoverIn={(event) => { setHovering(true); onHoverIn?.(event) }}
      onHoverOut={(event) => { setHovering(false); onHoverOut?.(event) }}
      onFocus={(event) => { setFocused(true); onFocus?.(event) }}
      onBlur={(event) => { setFocused(false); onBlur?.(event) }}
      onLayout={(event) => { inner.value = event.nativeEvent.layout.width - INSET * 2; onLayout?.(event) }}
      {...rest}
    >
      <Animated.Text numberOfLines={1} style={[styles.label, secondary ? styles.labelSecondary : styles.labelPrimary, off && styles.labelOff, labelStyle]}>{children}</Animated.Text>
      <Animated.View style={[styles.chip, secondary ? styles.chipSecondary : styles.chipPrimary, off && styles.chipOff, chipStyle]}>
        {SHADES.map((_, index) => <Chevron key={index} index={index} open={open} secondary={secondary} off={off} />)}
      </Animated.View>
    </PressScale>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { maxWidth: '100%', width: 180 },
  button: { borderRadius: radius.full, height: 40, justifyContent: 'center' },
  primary: { backgroundColor: c.inverse },
  secondary: { backgroundColor: c.ink5 },
  secondaryPressed: { backgroundColor: c.ink10 },
  buttonOff: { backgroundColor: c.ink5 },
  label: { ...type(18, c.textPrimary, '500'), left: INSET + CHIP + space[3], position: 'absolute', right: space[4] },
  labelPrimary: { color: c.textInverse },
  labelSecondary: { color: c.textPrimary },
  labelOff: { color: c.textQuaternary },
  chip: { alignItems: 'center', borderRadius: radius['2xl'], flexDirection: 'row', gap: space[4], height: CHIP, left: INSET, overflow: 'hidden', paddingLeft: space[3], position: 'absolute' },
  chipPrimary: { backgroundColor: c.surface },
  chipSecondary: { backgroundColor: c.inverse },
  chipOff: { backgroundColor: c.ink5 },
  trail: { alignItems: 'center', flexDirection: 'row', gap: space[0.5] },
  column: { justifyContent: 'space-between' },
  tall: { height: 18 },
  short: { height: 10 },
  dot: { borderRadius: radius.full, height: 2, width: 2 },
  dotPrimary: { backgroundColor: c.textPrimary },
  dotSecondary: { backgroundColor: c.textInverse },
  dotOff: { backgroundColor: c.textQuaternary },
})
