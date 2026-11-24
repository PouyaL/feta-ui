import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT, HEIGHT, ICON_SIZE, LabelSwap, TARGET, usePressScale, withInk, type Spring } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

const RING_MS = 1200
const TILT = -12
const WIDTH_MS = 320
const BELL: Spring = { stiffness: 380, damping: 5, mass: 1 }
const CLAPPER: Spring = { stiffness: 150, damping: 4, mass: 1 }
const RESIZE = LinearTransition.duration(WIDTH_MS).easing(EASE_OUT)

export type BellButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  variant?: 'default' | 'compact' | 'icon'
  pressed?: boolean
  defaultPressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  label?: string
  pressedLabel?: string
  /** Draws `bell`, `bell-ring` and `bell-off`. */
  renderIcon: RenderIcon
  /** `false` turns off the swing and the press scale. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A subscribe toggle with a bell that swings on two coupled springs. */
export function BellButton({ variant = 'default', pressed, defaultPressed = false, onPressedChange, label = 'Subscribe', pressedLabel = 'Subscribed', renderIcon, animated = true, onPress, disabled, style, ...rest }: BellButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const off = Boolean(disabled)
  const pressing = usePressScale(still || off)
  const [held, setHeld] = useState(defaultPressed)
  const [ringing, setRinging] = useState(false)
  const bell = useSharedValue(0)
  const clapper = useSharedValue(0)
  const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${bell.value}deg` }] }))
  const clapperStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${clapper.value}deg` }] }))
  const on = pressed ?? held

  useEffect(() => {
    if (!ringing) return undefined
    const timer = setTimeout(() => setRinging(false), RING_MS)
    return () => clearTimeout(timer)
  }, [ringing])

  function handlePress(event: GestureResponderEvent): void {
    onPress?.(event)
    const next = !on
    setHeld(next)
    onPressedChange?.(next)
    if (!next || still) return
    setRinging(true)
    bell.value = TILT
    bell.value = withSpring(0, BELL)
    clapper.value = -TILT / 2
    clapper.value = withSpring(0, CLAPPER)
  }

  const contentKey = CONTENT[variant]
  const icon = !on ? 'bell-off' : ringing ? 'bell-ring' : 'bell'
  const text = on ? pressedLabel : label
  const ink = off ? colors.textQuaternary : on ? colors.textInverse : colors.textPrimary

  return (
    <Animated.View style={[styles.box, pressing.style, style]}>
      <Animated.View {...(still ? {} : { layout: RESIZE })} style={[styles.shell, styles[variant], on ? styles.shellOn : styles.shellRest, off && styles.shellOff]}>
        <Pressable
          accessibilityRole="togglebutton"
          accessibilityLabel={text}
          aria-checked={on}
          aria-disabled={off}
          disabled={disabled}
          hitSlop={variant === 'compact' ? (TARGET - HEIGHT.sm) / 2 : undefined}
          style={[styles.content, contentKey && styles[contentKey]]}
          onPress={handlePress}
          onPressIn={pressing.pressIn}
          onPressOut={pressing.pressOut}
          {...rest}
        >
          <Animated.View style={[styles.bell, bellStyle]}>
            <Animated.View style={[styles.bell, clapperStyle]}>{withInk(renderIcon(icon, ICON_SIZE), ink)}</Animated.View>
          </Animated.View>
          {variant === 'icon' ? null : (
            <LabelSwap swapKey={text} still={still}>
              <Text numberOfLines={1} style={[styles.label, variant === 'compact' && styles.labelCompact, on && styles.labelOn, off && styles.labelOff]}>{text}</Text>
            </LabelSwap>
          )}
        </Pressable>
      </Animated.View>
    </Animated.View>
  )
}

const CONTENT = { default: 'contentDefault', compact: 'contentCompact', icon: null } as const

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  shell: { borderRadius: radius.full, overflow: 'hidden' },
  default: { height: HEIGHT.md },
  compact: { height: HEIGHT.sm },
  icon: { height: HEIGHT.md, width: HEIGHT.md },
  shellRest: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1 },
  shellOn: { backgroundColor: c.inverse },
  shellOff: { backgroundColor: c.ink5, borderColor: 'transparent' },
  content: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: space[1.5], justifyContent: 'center' },
  contentDefault: { paddingLeft: space[3.5], paddingRight: space[4] },
  contentCompact: { paddingHorizontal: space[2.5] },
  bell: { transformOrigin: '50% 10%' },
  label: type(16, c.textPrimary, '500'),
  labelCompact: { fontSize: 14 },
  labelOn: { color: c.textInverse },
  labelOff: { color: c.textQuaternary },
})
