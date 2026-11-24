import { useEffect, useRef, useState } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useColors } from '../kit'
import { Button } from './button'
import { useStill, type RenderIcon } from './card'
import { IconButton } from './icon-button'
import { iconFor } from './label'

const SLOW_MS = 260
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)

export type ThemeValue = 'light' | 'dark'

export type ThemeSwitchProps = {
  /** `icon` is the circle Icon Button, `label` a pill Button with a label. */
  kind?: 'icon' | 'label'
  value?: ThemeValue
  defaultValue?: ThemeValue
  /** Apply the theme here. */
  onValueChange?: (value: ThemeValue) => void
  disabled?: boolean
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Switches the app between light and dark. The sun folds into the moon. */
export function ThemeSwitch({ kind = 'icon', value, defaultValue = 'light', onValueChange, disabled = false, renderIcon, animated = true, style }: ThemeSwitchProps) {
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState<ThemeValue>(defaultValue)
  const current = value ?? held
  const dark = current === 'dark'
  const next: ThemeValue = dark ? 'light' : 'dark'
  const fold = useSharedValue(1)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    fold.value = still ? 1 : 0
    if (!still) fold.value = withTiming(1, { duration: SLOW_MS, easing: OUT })
  }, [current, still, fold])

  const glyphStyle = useAnimatedStyle(() => ({ opacity: fold.value, transform: [{ rotate: `${(1 - fold.value) * -90}deg` }, { scale: 0.8 + fold.value * 0.2 }] }))

  function toggle(): void {
    setHeld(next)
    onValueChange?.(next)
  }

  const glyph = <Animated.View style={glyphStyle}>{iconFor(renderIcon, dark ? 'moon' : 'sun', 16, colors.textPrimary)}</Animated.View>

  if (kind === 'label') {
    return <Button variant="secondary" shape="pill" animated={animated} disabled={disabled} leadingIcon={glyph} accessibilityLabel={`Switch to ${next} theme`} {...(style ? { style } : {})} onPress={toggle}>{dark ? 'Dark' : 'Light'}</Button>
  }
  return <IconButton variant="secondary" animated={animated} disabled={disabled} label={`Switch to ${next} theme`} icon={glyph} {...(style ? { style } : {})} onPress={toggle} />
}
