import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { accent, radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT } from './button'
import { type, useStill, useThemed } from './card'

const SWATCH = 46
const RING_MS = 200
const STILL_MS = 120

export type ColorOption = { value: string; label: string; color: string; disabled?: boolean }

/** The default swatches. Graphite follows the color scheme, so this is a function of the colors. */
export const defaultColors = (colors: Colors): ColorOption[] => [
  { value: 'graphite', label: 'Graphite', color: colors.textPrimary },
  { value: 'sky', label: 'Sky', color: accent.sky.to },
  { value: 'emerald', label: 'Emerald', color: accent.emerald.to },
  { value: 'violet', label: 'Violet', color: accent.violet.to },
  { value: 'orange', label: 'Orange', color: accent.orange.to },
  { value: 'amber', label: 'Amber', color: accent.amber.to },
]

export type ColorSelectorProps = {
  legend?: string
  options?: ColorOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  /** `false` shows the ring without it growing. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Swatch({ option, on, off, still, onChoose }: { option: ColorOption; on: boolean; off: boolean; still: boolean; onChoose: () => void }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const shown = on && !off
  const ring = useSharedValue(shown ? 1 : 0)

  useEffect(() => {
    ring.value = withTiming(shown ? 1 : 0, still ? { duration: STILL_MS, easing: Easing.linear } : { duration: RING_MS, easing: EASE_OUT })
  }, [shown, still, ring])

  const ringStyle = useAnimatedStyle(() => ({ opacity: ring.value, transform: [{ scale: still ? 1 : 0.8 + 0.2 * ring.value }] }))

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={option.label}
      aria-checked={on}
      aria-disabled={off}
      disabled={off}
      style={styles.swatch}
      onPress={onChoose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, ringStyle]}>
        <Svg aria-hidden width={SWATCH} height={SWATCH}><Circle cx={SWATCH / 2} cy={SWATCH / 2} r={SWATCH / 2 - 1} stroke={option.color} strokeWidth={2} fill="none" /></Svg>
      </Animated.View>
      <View style={[styles.well, off && styles.wellOff]}>
        <Svg aria-hidden width={36} height={36}>
          <Circle cx={18} cy={18} r={17.5} fill={colors.ink4} stroke={colors.ink10} strokeWidth={1} />
          <Circle cx={18} cy={18} r={10} fill={option.color} />
        </Svg>
      </View>
    </Pressable>
  )
}

/** A single choice among color swatches. */
export function ColorSelector({ legend = 'Color', options, value, defaultValue, onValueChange, disabled, animated = true, style }: ColorSelectorProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const list = options ?? defaultColors(colors)
  const [held, setHeld] = useState(defaultValue ?? list[0]?.value)
  const current = value ?? held
  const chosen = list.find((option) => option.value === current)

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={legend} aria-disabled={Boolean(disabled)} style={[styles.tray, style]}>
      <View style={styles.header}>
        <Text style={styles.legend}>{legend}</Text>
        <Text style={styles.meta}>{chosen?.label}</Text>
      </View>
      <View style={styles.body}>
        {list.map((option) => (
          <Swatch
            key={option.value}
            option={option}
            on={option.value === current}
            off={Boolean(disabled || option.disabled)}
            still={still}
            onChoose={() => { setHeld(option.value); onValueChange?.(option.value) }}
          />
        ))}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { alignSelf: 'flex-start', backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: '100%', padding: space[1] },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingBottom: space[2.5], paddingHorizontal: space[3], paddingTop: space[2] },
  legend: type(16, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space[1], padding: space[2.5] },
  swatch: { alignItems: 'center', height: SWATCH, justifyContent: 'center', width: SWATCH },
  well: { height: 36, width: 36 },
  wellOff: { opacity: 0.4 },
})
