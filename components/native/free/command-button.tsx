import { useEffect, useState, type ReactNode } from 'react'
import { Platform, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT, HEIGHT, PressScale, withInk, type PressScaleProps } from './button'
import { type, useStill, useThemed } from './card'

const DOWN_MS = 75
const UP_MS = 150
const SINK = 2

export type CommandButtonProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  label?: string
  icon?: ReactNode
  /** The letter of the shortcut. Default `k`. The keys show on iPad only: wire the real key in your app. */
  shortcutKey?: string
  /** Default `mac` on iOS, `windows` elsewhere. */
  os?: 'mac' | 'windows'
  /** `false` turns off the press scale and the sinking keys. */
  animated?: boolean
}

function Keycap({ text, down, still, off }: { text: string; down: boolean; still: boolean; off: boolean }) {
  const styles = useThemed(createStyles)
  const sink = useSharedValue(0)
  const capStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sink.value }] }))

  useEffect(() => {
    sink.value = withTiming(down && !still ? SINK : 0, { duration: down ? DOWN_MS : UP_MS, easing: EASE_OUT })
  }, [down, still, sink])

  return (
    <View style={styles.well}>
      <Animated.View style={[styles.cap, off && styles.capOff, capStyle]}>
        <Text style={[styles.capText, off && styles.textOff]}>{text}</Text>
      </Animated.View>
    </View>
  )
}

/** A button that shows its shortcut as keycaps on iPad, sinking as it is pressed. Phones show the action alone. */
export function CommandButton({ label = 'Search', icon, shortcutKey = 'k', os = Platform.OS === 'ios' ? 'mac' : 'windows', animated = true, disabled, style, onPressIn, onPressOut, ...rest }: CommandButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [down, setDown] = useState(false)
  const off = Boolean(disabled)
  const keys = Platform.OS === 'ios' && Platform.isPad

  function handleIn(event: GestureResponderEvent): void {
    setDown(true)
    onPressIn?.(event)
  }

  function handleOut(event: GestureResponderEvent): void {
    setDown(false)
    onPressOut?.(event)
  }

  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={off}
      still={still}
      disabled={disabled}
      style={[styles.box, style]}
      contentStyle={[styles.button, keys && styles.withKeys, off && styles.buttonOff]}
      pressedStyle={styles.pressed}
      onPressIn={handleIn}
      onPressOut={handleOut}
      {...rest}
    >
      {withInk(icon, off ? colors.textQuaternary : colors.textPrimary)}
      <Text numberOfLines={1} style={[styles.label, off && styles.textOff]}>{label}</Text>
      {keys ? (
        <View style={styles.keys}>
          <Keycap text={os === 'mac' ? '⌘' : 'Ctrl'} down={down} still={still} off={off} />
          <Keycap text={shortcutKey.toUpperCase()} down={down} still={still} off={off} />
        </View>
      ) : null}
    </PressScale>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  button: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.xl, borderWidth: 1, flexDirection: 'row', gap: space[2.5], height: HEIGHT.md, paddingHorizontal: space[3.5] },
  withKeys: { paddingRight: space[1.5] },
  buttonOff: { backgroundColor: c.ink5, borderColor: 'transparent' },
  pressed: { backgroundColor: c.ink5 },
  label: type(16, c.textPrimary, '500'),
  textOff: { color: c.textQuaternary },
  keys: { flexDirection: 'row', gap: space[1] },
  well: { backgroundColor: c.ink10, borderRadius: radius.md, height: space[6] },
  cap: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink10, borderRadius: radius.md, borderWidth: 1, height: 22, justifyContent: 'center', paddingHorizontal: space[1.5] },
  capOff: { backgroundColor: 'transparent', borderColor: c.ink5 },
  capText: type(12, c.textSecondary, '400', true),
})
