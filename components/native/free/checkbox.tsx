import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, FadeOut, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { useFieldControl } from './field'
import { withInk } from './button'
import { iconFor } from './label'

const DRAW_MS = 180
const FOCUS_MS = 120
const MESSAGE_MS = 180
const DRAW_LEAD_MS = 60
const PRESS_MS = 100
const STAGGER_MS = 30
const POP = { stiffness: 420, damping: 26, mass: 1 } as const
const CHECK = 'M2.5 7.5 5.6 10.4 11.5 3.8'
const CHECK_LENGTH = 14
const MINUS = 'M3 7h8'
const MINUS_LENGTH = 8
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)

const AnimatedPath = Animated.createAnimatedComponent(Path)

type MarkProps = { filled: boolean; on: boolean; indeterminate: boolean; invalid: boolean; drawDelay: number; pressed: boolean; disabled: boolean; still: boolean }

function Stroke({ d, length, shown, delay, color, still }: { d: string; length: number; shown: boolean; delay: number; color: string; still: boolean }) {
  const drawn = useSharedValue(shown ? 1 : 0)
  useEffect(() => {
    if (still || !shown) { drawn.value = shown ? 1 : 0; return }
    drawn.value = withDelay(delay + DRAW_LEAD_MS, withTiming(1, { duration: DRAW_MS, easing: OUT }))
  }, [shown, delay, still, drawn])
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - drawn.value) }))
  return <AnimatedPath animatedProps={props} d={d} fill="none" stroke={color} strokeDasharray={[length, length]} strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.4} />
}

/** The box alone, so a row or card can be the one target. */
function CheckMark({ filled, on, indeterminate, invalid, drawDelay, pressed, disabled, still }: MarkProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const fill = useSharedValue(filled ? 1 : 0)
  const squeeze = useSharedValue(1)

  useEffect(() => {
    if (still) { fill.value = filled ? 1 : 0; return }
    fill.value = filled ? withDelay(drawDelay, withSpring(1, POP)) : withTiming(0, { duration: FOCUS_MS })
  }, [filled, drawDelay, still, fill])

  useEffect(() => {
    if (!still) squeeze.value = withTiming(pressed && !disabled ? 0.9 : 1, { duration: PRESS_MS, easing: OUT })
  }, [pressed, disabled, still, squeeze])

  const box = useAnimatedStyle(() => ({ transform: [{ scale: squeeze.value }] }))
  const fillStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, fill.value),
    transform: [{ scale: 0.6 + fill.value * 0.4 }],
  }))

  return (
    <Animated.View style={[styles.box, filled && styles.boxFilled, invalid && styles.boxInvalid, disabled && styles.boxDisabled, box]}>
      <Animated.View style={[styles.fill, invalid && styles.fillInvalid, fillStyle]} />
      <Svg aria-hidden width={16} height={16} viewBox="0 0 14 14">
        <Stroke d={MINUS} length={MINUS_LENGTH} shown={indeterminate} delay={drawDelay * 1000} color={colors.textInverse} still={still} />
        <Stroke d={CHECK} length={CHECK_LENGTH} shown={on && !indeterminate} delay={drawDelay * 1000} color={colors.textInverse} still={still} />
      </Svg>
    </Animated.View>
  )
}

function useChecked(checked: boolean | undefined, defaultChecked: boolean, onCheckedChange: ((next: boolean) => void) | undefined) {
  const [held, setHeld] = useState(defaultChecked)
  const on = checked ?? held
  return { on, toggle: (): void => { setHeld(!on); onCheckedChange?.(!on) } }
}

export type CheckboxProps = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** For parents of a list: some children are checked. */
  indeterminate?: boolean
  invalid?: boolean
  disabled?: boolean
  required?: boolean
  /** Seconds to delay the check, so a group can ripple. */
  drawDelay?: number
  accessibilityLabel?: string
  /** Draws the mark only, for a row that is itself the control: no press, no tab stop, hidden from screen readers. */
  decorative?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** The box gives under the finger, fills from the centre and draws its check. */
export function Checkbox({ checked, defaultChecked = false, onCheckedChange, indeterminate = false, invalid, disabled, required, drawDelay = 0, accessibilityLabel, decorative = false, animated = true, style }: CheckboxProps) {
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled, required })
  const { on, toggle } = useChecked(checked, defaultChecked, onCheckedChange)
  const [pressed, setPressed] = useState(false)
  if (decorative) return <View aria-hidden pointerEvents="none" style={style}><CheckMark filled={on || indeterminate} on={on} indeterminate={indeterminate} invalid={field.invalid} drawDelay={drawDelay} pressed={false} disabled={field.disabled} still={still} /></View>
  return (
    <Pressable
      accessibilityHint={field.hint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="checkbox"
      aria-checked={indeterminate ? 'mixed' : on}
        aria-disabled={field.disabled}
      disabled={field.disabled}
      hitSlop={11}
      style={style}
      onPress={toggle}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <CheckMark filled={on || indeterminate} on={on} indeterminate={indeterminate} invalid={field.invalid} drawDelay={drawDelay} pressed={pressed} disabled={field.disabled} still={still} />
    </Pressable>
  )
}

export type CheckboxFieldProps = CheckboxProps & {
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
  renderIcon?: RenderIcon
}

const errorIn = FadeInDown.duration(MESSAGE_MS).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 4 }] })

/** A checkbox with a label and description. The whole row is the hit area. */
export function CheckboxField({ label, description, error, checked, defaultChecked = false, onCheckedChange, indeterminate = false, invalid, disabled, required, drawDelay = 0, accessibilityLabel, renderIcon, animated = true, style }: CheckboxFieldProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const field = useFieldControl({ invalid: invalid ?? (error ? true : undefined), disabled, required })
  const { on, toggle } = useChecked(checked, defaultChecked, onCheckedChange)
  const [pressed, setPressed] = useState(false)
  return (
    <View style={[styles.field, field.disabled && styles.dimmed, style]}>
      <Pressable
        accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
        accessibilityHint={typeof description === 'string' ? description : field.hint}
        accessibilityRole="checkbox"
        aria-checked={indeterminate ? 'mixed' : on}
        aria-disabled={field.disabled}
        disabled={field.disabled}
        // The web row has no minimum height, so an error sits right under the label; the slop keeps a 44 point target.
        hitSlop={{ top: 11, bottom: 11 }}
        style={styles.row}
        onPress={toggle}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <CheckMark filled={on || indeterminate} on={on} indeterminate={indeterminate} invalid={field.invalid} drawDelay={drawDelay} pressed={pressed} disabled={field.disabled} still={still} />
        <View style={styles.text}>
          <Text style={styles.title}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
      </Pressable>
      {error ? (
        <Animated.View {...(still ? {} : { entering: errorIn, exiting: FadeOut.duration(MESSAGE_MS) })} accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.message, styles.errorIndent]}>
          {iconFor(renderIcon, 'alert-circle', 14, colors.danger)}
          <Text style={styles.error}>{error}</Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

export type CheckboxCardProps = Omit<CheckboxProps, 'style'> & { title: ReactNode; description?: ReactNode; icon?: ReactNode; style?: StyleProp<ViewStyle> }

/** A whole card that toggles. */
export function CheckboxCard({ title, description, icon, checked, defaultChecked = false, onCheckedChange, indeterminate = false, invalid, disabled = false, drawDelay = 0, accessibilityLabel, animated = true, style }: CheckboxCardProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const { on, toggle } = useChecked(checked, defaultChecked, onCheckedChange)
  const [pressed, setPressed] = useState(false)
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? (typeof title === 'string' ? title : undefined)}
      accessibilityRole="checkbox"
      aria-checked={indeterminate ? 'mixed' : on}
      aria-disabled={disabled}
      disabled={disabled}
      style={[styles.card, on && styles.cardOn, on && !still && styles.cardLifted, disabled && styles.dimmed, style]}
      onPress={toggle}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      {icon ? <View style={[styles.tile, on && styles.tileOn]}>{withInk(icon, on ? colors.textInverse : colors.textPrimary)}</View> : null}
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <CheckMark filled={on || indeterminate} on={on} indeterminate={indeterminate} invalid={Boolean(invalid)} drawDelay={drawDelay} pressed={pressed} disabled={disabled} still={still} />
    </Pressable>
  )
}

export type CheckboxGroupProps = {
  /** The parent's label. */
  label: string
  items: { value: string; label: string; disabled?: boolean }[]
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  error?: ReactNode
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A list with a parent checkbox. Some children checked puts the parent in Indeterminate. */
export function CheckboxGroup({ label, items, value, defaultValue = [], onValueChange, error, renderIcon, animated = true, style }: CheckboxGroupProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultValue)
  const chosen = value ?? held
  const enabled = items.filter((item) => !item.disabled)
  const count = enabled.filter((item) => chosen.includes(item.value)).length
  const all = enabled.length > 0 && count === enabled.length

  function set(next: string[]): void {
    setHeld(next)
    onValueChange?.(next)
  }

  return (
    <View accessibilityLabel={label} style={[styles.group, style]}>
      <View style={styles.parent}>
        <CheckboxField style={styles.parentField} label={label} animated={animated} checked={all} indeterminate={count > 0 && !all} invalid={Boolean(error)} onCheckedChange={() => set(all ? [] : enabled.map((item) => item.value))} />
        <Text style={styles.count}>{count} of {enabled.length}</Text>
      </View>
      <View style={styles.list}>
        {items.map((item, i) => {
          const on = chosen.includes(item.value)
          return (
            <View key={item.value} style={[styles.item, on && styles.itemOn]}>
              <CheckboxField
                label={item.label}
                animated={animated}
                checked={on}
                invalid={Boolean(error)}
                disabled={item.disabled ?? false}
                drawDelay={still ? 0 : (i * STAGGER_MS) / 1000}
                onCheckedChange={(next) => set(next ? [...chosen, item.value] : chosen.filter((v) => v !== item.value))}
              />
            </View>
          )
        })}
      </View>
      {error ? (
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.message, styles.groupError]}>
          {iconFor(renderIcon, 'alert-circle', 14, colors.danger)}
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.textTertiary, borderRadius: radius.lg, borderWidth: 1.5, height: 22, justifyContent: 'center', overflow: 'hidden', width: 22 },
  // iOS draws a border above the fill, so a filled box takes the fill's ink, like the web where the fill covers the ring.
  boxFilled: { borderColor: c.inverse },
  boxInvalid: { borderColor: c.danger },
  boxDisabled: { opacity: 0.4 },
  fill: { ...StyleSheet.absoluteFill, backgroundColor: c.inverse, borderRadius: radius.md },
  fillInvalid: { backgroundColor: c.danger },
  field: { flexShrink: 1, gap: space[1], minWidth: 0 },
  dimmed: { opacity: 0.5 },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: space[2.5] },
  text: { flex: 1, minWidth: 0 },
  title: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  description: { ...type(14, c.textSecondary), lineHeight: 20 },
  message: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  error: { ...type(12, c.danger), flexShrink: 1 },
  errorIndent: { paddingLeft: space[7] },
  card: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: space[3], minHeight: 44, paddingHorizontal: space[4], paddingVertical: space[3.5] },
  cardOn: { borderColor: c.textPrimary, borderWidth: 1.5 },
  cardLifted: { transform: [{ translateY: -1 }] },
  tile: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.xl, height: 36, justifyContent: 'center', width: 36 },
  tileOn: { backgroundColor: c.inverse },
  group: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1] },
  parent: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingHorizontal: space[3], paddingVertical: space[2] },
  parentField: { flex: 1 },
  count: type(12, c.textTertiary, '400', true),
  list: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[0.5], padding: space[1] },
  item: { borderRadius: radius.xl, justifyContent: 'center', minHeight: 44, paddingHorizontal: space[2.5], paddingVertical: space[2] },
  itemOn: { backgroundColor: c.ink4 },
  groupError: { paddingHorizontal: space[3], paddingVertical: space[2] },
})
