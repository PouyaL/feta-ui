import { useState } from 'react'
import { StyleSheet, Text, View, type GestureResponderEvent } from 'react-native'
import { radius, space, useColors, type Colors } from '../kit'
import { HEIGHT, ICON_SIZE, LabelSwap, PressScale, withInk, type PressScaleProps } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

export type ThemeValue = 'light' | 'dark'

export type ThemeToggleProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  kind?: 'round' | 'labeled' | 'icon'
  value?: ThemeValue
  defaultValue?: ThemeValue
  /** Apply the theme here. */
  onValueChange?: (value: ThemeValue) => void
  /** Draws `sun` and `moon`. */
  renderIcon: RenderIcon
  /** `false` swaps the icon without the rise. */
  animated?: boolean
}

/** A light and dark switch that shows a sun or a moon, so the value reads at a glance. */
export function ThemeToggle({ kind = 'round', value, defaultValue = 'light', onValueChange, renderIcon, animated = true, disabled, style, onPress, accessibilityState, ...rest }: ThemeToggleProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState<ThemeValue>(defaultValue)
  const current = value ?? held
  const dark = current === 'dark'
  const off = Boolean(disabled)
  const ink = off ? colors.textQuaternary : dark ? colors.textInverse : colors.textPrimary

  function handlePress(event: GestureResponderEvent): void {
    onPress?.(event)
    const next: ThemeValue = dark ? 'light' : 'dark'
    setHeld(next)
    onValueChange?.(next)
  }

  const icon = withInk(renderIcon(dark ? 'moon' : 'sun', ICON_SIZE), ink)

  return (
    <PressScale
      accessibilityRole="switch"
      accessibilityLabel="Dark theme"
      aria-checked={dark}
      aria-disabled={off}
      {...(accessibilityState ? { accessibilityState } : {})}
      still={still}
      disabled={disabled}
      style={[styles.box, style]}
      contentStyle={[styles[kind], kind !== 'round' && (dark ? styles.dark : styles.light), off && styles.buttonOff]}
      onPress={handlePress}
      {...rest}
    >
      {kind === 'round' ? (
        <View style={[styles.face, dark ? styles.dark : styles.light, off && styles.faceOff]}>
          <LabelSwap swapKey={current} still={still}>{icon}</LabelSwap>
        </View>
      ) : (
        <LabelSwap swapKey={current} still={still} style={styles.row}>
          {icon}
          {kind === 'labeled' ? <Text numberOfLines={1} style={[styles.label, dark && styles.labelDark, off && styles.labelOff]}>{dark ? 'Dark' : 'Light'}</Text> : null}
        </LabelSwap>
      )}
    </PressScale>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  round: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.full, height: HEIGHT.lg, justifyContent: 'center', width: HEIGHT.lg },
  labeled: { alignItems: 'center', borderRadius: radius.xl, height: HEIGHT.md, justifyContent: 'center', minWidth: 80, overflow: 'hidden', paddingLeft: space[3], paddingRight: space[3.5] },
  icon: { alignItems: 'center', borderRadius: radius.full, height: HEIGHT.md, justifyContent: 'center', overflow: 'hidden', width: HEIGHT.md },
  face: { alignItems: 'center', borderRadius: radius.full, height: 44, justifyContent: 'center', overflow: 'hidden', width: 44 },
  light: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1 },
  dark: { backgroundColor: c.inverse, borderColor: 'transparent', borderWidth: 1 },
  buttonOff: { backgroundColor: c.ink5, borderColor: 'transparent' },
  faceOff: { backgroundColor: 'transparent', borderColor: 'transparent' },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  label: type(16, c.textPrimary, '500'),
  labelDark: { color: c.textInverse },
  labelOff: { color: c.textQuaternary },
})
