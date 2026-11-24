import { useState, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { useSlidingLift } from './button-group'
import { useStill, useThemed } from './card'
import { TOGGLE_SPRING, Toggle } from './toggle'

export type ToggleGroupItem = {
  value: string
  /** Visible text. Leave it out for an icon only toggle and pass `ariaLabel`. */
  label?: string
  icon?: ReactNode
  ariaLabel?: string
  disabled?: boolean
}

type Shared = {
  /** The group's accessible name. */
  label: string
  items: ToggleGroupItem[]
  /** `segment` lifts onto a tray; `outline` spaces Outline toggles 4 apart. Default `segment`. */
  appearance?: 'segment' | 'outline'
  orientation?: 'horizontal' | 'vertical'
  disabled?: boolean
  /** `false` turns off the press scale and the sliding lift. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

export type ToggleGroupProps = Shared & (
  | { type: 'single'; value?: string | null; defaultValue?: string | null; onValueChange?: (value: string) => void }
  | { type: 'multiple'; value?: string[]; defaultValue?: string[]; onValueChange?: (value: string[]) => void }
)

/** Toggles in a group. Single choice keeps one on; multiple choice allows none. */
export function ToggleGroup(props: ToggleGroupProps) {
  const { label, items, appearance = 'segment', orientation = 'horizontal', disabled, animated = true, style } = props
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [heldOne, setHeldOne] = useState(props.type === 'single' ? props.defaultValue ?? null : null)
  const [heldMany, setHeldMany] = useState(props.type === 'multiple' ? props.defaultValue ?? [] : [])

  const single = props.type === 'single'
  const selected: string[] = props.type === 'single'
    ? [props.value === undefined ? heldOne : props.value].filter((value): value is string => value !== null)
    : props.value ?? heldMany
  const slides = single && appearance === 'segment' && !still
  const { liftStyle, measure } = useSlidingLift(slides ? selected[0] : null, TOGGLE_SPRING, still)

  function choose(value: string): void {
    if (props.type === 'single') {
      setHeldOne(value)
      props.onValueChange?.(value)
    } else {
      const next = selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]
      setHeldMany(next)
      props.onValueChange?.(next)
    }
  }

  return (
    <View
      accessibilityRole={single ? 'radiogroup' : 'toolbar'}
      accessibilityLabel={label}
      style={[styles.group, orientation === 'vertical' && styles.vertical, appearance === 'segment' ? styles.segment : styles.outline, appearance === 'segment' && orientation === 'vertical' && styles.segmentVertical, style]}
    >
      {slides ? <Animated.View pointerEvents="none" style={[styles.lift, liftStyle]} /> : null}
      {items.map((item) => {
        const on = selected.includes(item.value)
        return (
          <View key={item.value} onLayout={measure(item.value)}>
            <Toggle
              appearance={appearance}
              icon={item.icon}
              pressed={on}
              animated={animated}
              disabled={disabled || item.disabled}
              accessibilityRole={single ? 'radio' : 'togglebutton'}
              accessibilityLabel={item.ariaLabel ?? item.label}
              sliding={slides}
              style={orientation === 'vertical' && styles.stretch}
              onPressedChange={() => { if (!single || !on) choose(item.value) }}
            >
              {item.label}
            </Toggle>
          </View>
        )
      })}
    </View>
  )
}

/** Floating surface for groups of toggles, split by `ToggleToolbarSeparator`. */
export function ToggleToolbar({ label, children, style }: { label: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemed(createStyles)
  return <View accessibilityLabel={label} style={[styles.toolbar, style]}>{children}</View>
}

export function ToggleToolbarSeparator() {
  const styles = useThemed(createStyles)
  return <View style={styles.separator} />
}

const createStyles = (c: Colors) => StyleSheet.create({
  group: { alignSelf: 'flex-start', flexDirection: 'row' },
  vertical: { flexDirection: 'column' },
  segment: { backgroundColor: c.ink4, borderRadius: radius.full, gap: space[0.5], padding: space[1] },
  segmentVertical: { borderRadius: radius.card },
  outline: { gap: space[1] },
  lift: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, left: 0, position: 'absolute', top: 0 },
  stretch: { alignSelf: 'stretch' },
  toolbar: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', gap: space[1.5], padding: space[1] },
  separator: { backgroundColor: c.ink8, height: space[4.5], width: 1 },
})
