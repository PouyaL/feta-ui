import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, TextInput, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { accent, radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT } from './button'
import { type, useStill, type RenderIcon } from './card'
import { IconButton } from './icon-button'
import { MetalRing, shadowInk } from './metal-frame'

/*
 * What differs from web: the ring is Metal Frame's native ring (stacked dashes drifting round a stroked rounded rect)
 * in place of the WebGL shader, so `bend`, the swell toward a mouse pointer, is left out; touch never bends it on the
 * web either. The focus glow is a native shadow in the sky tint, and blue-700 maps to the sky deep accent in kit.ts.
 * Icons come from `renderIcon`. The field is the Mobile size: 50 high, 16 px type.
 */

/** Ring strength at rest, and when focused or thinking. */
const REST_STRENGTH = 0.55
/** Bands drift this many times faster while thinking. */
const THINKING_SPEED = 2.5
const FOCUS_MS = 400
const FIELD_HEIGHT = 50
const ICON = 16
const SEND_ICON = 20

export type BezelFrameProps = {
  /** The field's accessible name. */
  label: string
  placeholder?: string
  defaultValue?: string
  /** The ring runs faster, send becomes stop, and the field says Thinking. */
  thinking?: boolean
  disabled?: boolean
  onSubmit?: (value: string) => void
  onStop?: () => void
  /** Draws `send`, `stop` and `sparkles`. */
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A single prompt seated in a bezel ringed in sky chrome, for a hero search. */
export function BezelFrame({ label, placeholder = 'Ask me anything…', defaultValue = '', thinking = false, disabled = false, onSubmit, onStop, renderIcon, animated = true, style }: BezelFrameProps) {
  const colors = useColors()
  const dark = useColorScheme() === 'dark'
  const styles = useMemo(() => createStyles(colors, dark), [colors, dark])
  const still = useStill(animated)
  const [value, setValue] = useState(defaultValue)
  const [focused, setFocused] = useState(false)
  const lit = useSharedValue(0)

  useEffect(() => {
    const target = focused && !disabled ? 1 : 0
    lit.value = still ? target : withTiming(target, { duration: FOCUS_MS, easing: EASE_OUT })
  }, [focused, disabled, still, lit])

  const litStyle = useAnimatedStyle(() => ({ opacity: lit.value }))

  function submit(): void {
    if (disabled) return
    if (thinking) onStop?.()
    else if (value.trim()) onSubmit?.(value)
  }

  return (
    <View aria-disabled={disabled} style={[styles.bezel, disabled && styles.disabled, style]}>
      {disabled ? null : <Animated.View pointerEvents="none" style={[styles.glow, litStyle]} />}
      <View style={styles.field}>
        <Animated.View pointerEvents="none" style={[styles.fieldRing, litStyle]} />
        {thinking ? <View aria-hidden style={styles.lead}>{renderIcon('sparkles', ICON)}</View> : null}
        <TextInput
          accessibilityLabel={label}
          aria-disabled={disabled}
          editable={!thinking && !disabled}
          value={thinking ? 'Thinking' : value}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.textPrimary}
          returnKeyType="send"
          submitBehavior="blurAndSubmit"
          style={styles.input}
          onChangeText={setValue}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={submit}
        />
        <IconButton
          variant={focused && !thinking ? 'primary' : 'ghost'}
          icon={renderIcon(thinking ? 'stop' : 'send', SEND_ICON)}
          label={thinking ? 'Stop' : 'Send'}
          animated={animated}
          style={styles.send}
          disabled={disabled}
          onPress={submit}
        />
      </View>
      <MetalRing borderRadius={radius.full} tint="sky" disabled={disabled} still={still || disabled} strength={focused || thinking ? 1 : REST_STRENGTH} speed={thinking ? THINKING_SPEED : 1} />
    </View>
  )
}

const createStyles = (c: Colors, dark: boolean) => {
  const shade = shadowInk(c, dark)
  return StyleSheet.create({
    bezel: {
      backgroundColor: c.surface, borderRadius: radius.full, elevation: 2, maxWidth: 420, padding: space[0.5], width: '100%',
      shadowColor: shade.color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: shade.opacity, shadowRadius: 10,
    },
    disabled: { backgroundColor: c.ink5, elevation: 0, opacity: 0.5, shadowOpacity: 0 },
    // Focus: a soft glow in the deep sky tint, 40% strong.
    glow: { ...StyleSheet.absoluteFill, backgroundColor: c.surface, borderRadius: radius.full, elevation: 8, shadowColor: accent.sky.deep, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 14 },
    field: { alignItems: 'center', backgroundColor: c.surface, borderRadius: radius.full, flexDirection: 'row', gap: space[2], height: FIELD_HEIGHT, paddingLeft: space[5], paddingRight: space[1.5] },
    fieldRing: { ...StyleSheet.absoluteFill, borderColor: accent.sky.from, borderRadius: radius.full, borderWidth: 1 },
    lead: { alignSelf: 'center', flexShrink: 0 },
    // Button hugs the top of its row by default; the web centres send in the 50 point field.
    send: { alignSelf: 'center' },
    // Fills the field's height: a 24 point box clipped the placeholder's descenders and sat it low on iOS. iOS
    // centres a single line input's text in its box, so a tall box keeps value and placeholder on the same line.
    input: { ...type(16, c.textPrimary), alignSelf: 'stretch', flex: 1, minWidth: 0, paddingVertical: 0 },
  })
}
